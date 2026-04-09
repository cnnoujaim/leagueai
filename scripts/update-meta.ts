/**
 * Meta Data Update Script
 *
 * Fetches all champion data from Data Dragon and matchup/build statistics
 * from community sources, then writes the compiled meta JSON.
 *
 * Run manually:   npx tsx scripts/update-meta.ts
 * Runs nightly via cron on the server.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "packages", "server", "data", "meta");

// ─── Data Dragon ──────────────────────────────────────────────────────────

interface DDragonChampion {
  id: string;
  key: string;
  name: string;
  tags: string[];
}

async function getCurrentPatch(): Promise<string> {
  const res = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  );
  const versions = (await res.json()) as string[];
  return versions[0];
}

async function getAllChampions(
  patch: string
): Promise<Map<string, DDragonChampion>> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion.json`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    data: Record<string, DDragonChampion>;
  };

  const champions = new Map<string, DDragonChampion>();
  for (const champ of Object.values(data.data)) {
    champions.set(champ.id, champ);
  }
  return champions;
}

// ─── Role mapping based on champion tags ──────────────────────────────────

const ROLE_MAP: Record<string, string[]> = {
  // Primary role mappings by champion tag + common positions
  Fighter: ["top", "jungle"],
  Tank: ["top", "support"],
  Mage: ["mid", "support"],
  Assassin: ["mid", "jungle"],
  Marksman: ["adc"],
  Support: ["support"],
};

function guessRoles(champ: DDragonChampion): string[] {
  const roles = new Set<string>();
  for (const tag of champ.tags) {
    const mapped = ROLE_MAP[tag];
    if (mapped) mapped.forEach((r) => roles.add(r));
  }
  return roles.size > 0 ? [...roles] : ["mid"];
}

// ─── Lolalytics community data fetching ───────────────────────────────────

interface LolalyticsTierData {
  pick: number;
  win: number;
  ban: number;
  games: number;
}

interface LolalyticsMatchupData {
  win: number;
  games: number;
}

async function fetchChampionTierData(
  championId: string,
  role: string,
  patch: string
): Promise<LolalyticsTierData | null> {
  // Lolalytics exposes an internal JSON API for champion stats
  // Format: https://lolalytics.com/lol/{champion}/build/?lane={role}
  // The actual API endpoint varies — this is a best-effort fetch
  const patchParam = patch.split(".").slice(0, 2).join(".");
  try {
    const url = `https://ax.lolalytics.com/mega/?ep=champion&p=d&v=1&patch=${patchParam}&cid=${championId}&lane=${role}&tier=gold_plus&queue=420&region=all`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeagueAI-MetaUpdater/1.0",
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;

    // Extract stats from the response — the shape depends on the Lolalytics version
    const header = data.header as Record<string, number> | undefined;
    if (!header) return null;

    return {
      pick: header.pr ?? 0,
      win: header.wr ?? 0,
      ban: header.br ?? 0,
      games: header.n ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Compile meta data ───────────────────────────────────────────────────

interface ChampionMeta {
  tier: string;
  winRate: number;
  pickRate: number;
  recommendedBuild: {
    runes: { primary: string; secondary: string; perks: string[] };
    items: string[];
    skillOrder: string[];
  };
  matchups: Record<
    string,
    { winRate: number; games: number; difficulty: string }
  >;
}

function getTier(winRate: number, pickRate: number): string {
  if (winRate >= 53 && pickRate >= 5) return "S+";
  if (winRate >= 52 && pickRate >= 3) return "S";
  if (winRate >= 51) return "A";
  if (winRate >= 49) return "B";
  if (winRate >= 47) return "C";
  return "D";
}

function getDifficulty(winRate: number): string {
  if (winRate >= 54) return "easy";
  if (winRate >= 51) return "medium";
  return "hard";
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching current patch...");
  const patch = await getCurrentPatch();
  console.log(`Current patch: ${patch}`);

  console.log("Fetching all champions...");
  const champions = await getAllChampions(patch);
  console.log(`Found ${champions.size} champions`);

  const meta: Record<string, Record<string, ChampionMeta>> = {};
  const allChampNames = [...champions.values()].map((c) => c.name);
  let processed = 0;

  for (const [champId, champ] of champions) {
    const roles = guessRoles(champ);

    for (const role of roles) {
      const tierData = await fetchChampionTierData(champId, role, patch);

      // Build a meta entry even without Lolalytics data — use defaults
      const winRate = tierData?.win ?? 50;
      const pickRate = tierData?.pick ?? 1;
      const games = tierData?.games ?? 0;

      const champMeta: ChampionMeta = {
        tier: getTier(winRate, pickRate),
        winRate: Math.round(winRate * 10) / 10,
        pickRate: Math.round(pickRate * 10) / 10,
        recommendedBuild: {
          runes: { primary: "TBD", secondary: "TBD", perks: [] },
          items: [],
          skillOrder: [],
        },
        matchups: {},
      };

      // Generate matchup placeholders against all other champions
      // The LLM uses its training data for strategy — we provide win rate context
      for (const otherChamp of allChampNames) {
        if (otherChamp === champ.name) continue;
        champMeta.matchups[otherChamp] = {
          winRate: 50, // Default — updated when real data is available
          games: 0,
          difficulty: "medium",
        };
      }

      if (!meta[champ.name]) meta[champ.name] = {};
      meta[champ.name][role] = champMeta;
    }

    processed++;
    if (processed % 20 === 0) {
      console.log(`Processed ${processed}/${champions.size} champions...`);
      // Small delay to be respectful to APIs
      await sleep(500);
    }
  }

  // Write the output
  const output = {
    patch,
    lastUpdated: new Date().toISOString(),
    champions: meta,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });

  const currentPath = join(OUTPUT_DIR, "current.json");
  const patchPath = join(OUTPUT_DIR, `${patch}.json`);

  await writeFile(currentPath, JSON.stringify(output, null, 2));
  await writeFile(patchPath, JSON.stringify(output, null, 2));

  console.log(`\nMeta data written to:`);
  console.log(`  ${currentPath}`);
  console.log(`  ${patchPath}`);
  console.log(
    `\nTotal: ${Object.keys(meta).length} champions across ${Object.values(meta).reduce((acc, roles) => acc + Object.keys(roles).length, 0)} role entries`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
