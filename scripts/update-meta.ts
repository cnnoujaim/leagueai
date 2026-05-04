/**
 * Meta Data Update Script
 *
 * Fetches all champion data from Data Dragon and build/matchup statistics
 * from Lolalytics (via HTML scraping), then writes the compiled meta JSON.
 *
 * Run manually:   npx tsx scripts/update-meta.ts
 * Runs nightly via cron on the server.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "packages", "server", "data", "meta");

// ─── Types ───────────────────────────────────────────────────────────────

interface DDragonChampion {
  id: string;
  key: string;
  name: string;
  tags: string[];
}

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

// ─── Data Dragon ─────────────────────────────────────────────────────────

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

async function getItemMap(patch: string): Promise<Map<number, string>> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/item.json`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    data: Record<string, { name: string }>;
  };
  const map = new Map<number, string>();
  for (const [id, item] of Object.entries(data.data)) {
    map.set(Number(id), item.name);
  }
  return map;
}

async function getRuneMap(patch: string): Promise<Map<number, string>> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/runesReforged.json`;
  const res = await fetch(url);
  const trees = (await res.json()) as Array<{
    id: number;
    name: string;
    slots: Array<{ runes: Array<{ id: number; name: string }> }>;
  }>;
  const map = new Map<number, string>();
  for (const tree of trees) {
    map.set(tree.id, tree.name);
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        map.set(rune.id, rune.name);
      }
    }
  }
  return map;
}

// ─── Role mapping ────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, string[]> = {
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

// Our role names → Lolalytics lane names
const ROLE_TO_LANE: Record<string, string> = {
  top: "top",
  jungle: "jungle",
  mid: "middle",
  adc: "bottom",
  support: "support",
};

// ─── Lolalytics HTML scraping ────────────────────────────────────────────

// Rune tree index order used by Lolalytics page state
const RUNE_TREE_ORDER = [
  "Precision",
  "Domination",
  "Sorcery",
  "Resolve",
  "Inspiration",
];

// Data Dragon IDs that don't match Lolalytics URL slugs
const CHAMPION_SLUG_OVERRIDES: Record<string, string> = {
  MonkeyKing: "wukong",
};

function getChampSlug(ddId: string): string {
  return CHAMPION_SLUG_OVERRIDES[ddId] ?? ddId.toLowerCase();
}

/**
 * Extract the Qwik serialized state (objs array) from a Lolalytics HTML page.
 */
function parseQwikState(html: string): any[] | null {
  const match = html.match(/<script type="qwik\/json">(.*?)<\/script>/s);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    return data.objs ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a single Qwik base-36 reference to its value in the objs array.
 */
function resolveRef(objs: any[], ref: any, depth = 0): any {
  if (depth > 6 || typeof ref !== "string") return ref;
  if (!/^[0-9a-z]+$/i.test(ref)) return ref;
  try {
    const idx = parseInt(ref, 36);
    if (idx >= 0 && idx < objs.length && objs[idx] !== ref) {
      return resolveRef(objs, objs[idx], depth + 1);
    }
  } catch {
    // not a valid reference
  }
  return ref;
}

/**
 * Recursively resolve all references in a nested object/array.
 */
function deepResolve(objs: any[], obj: any, depth = 0): any {
  if (depth > 5) return obj;
  if (typeof obj === "string") {
    const r = resolveRef(objs, obj);
    return r !== obj ? deepResolve(objs, r, depth + 1) : obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .slice(0, 30)
      .map((x) => deepResolve(objs, resolveRef(objs, x), depth + 1));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepResolve(objs, resolveRef(objs, v as any), depth + 1);
    }
    return result;
  }
  return obj;
}

interface ParsedBuild {
  winRate: number;
  pickRate: number;
  games: number;
  runes: {
    primaryTree: number;
    secondaryTree: number;
    primaryPerks: number[];
    secondaryPerks: number[];
  };
  coreItems: number[];
  item4: number[];
  item5: number[];
  item6: number[];
  skillPriority: string;
  counters: { strong: number[]; weak: number[] };
}

/**
 * Fetch and parse a champion's build page from Lolalytics.
 * Returns structured build data or null on failure.
 */
async function fetchChampionBuild(
  champDDId: string,
  lane: string
): Promise<ParsedBuild | null> {
  const slug = getChampSlug(champDDId);
  const url = `https://lolalytics.com/lol/${slug}/build/?lane=${lane}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;
    const html = await res.text();
    const objs = parseQwikState(html);
    if (!objs) return null;

    // Find the main data object (contains header + summary)
    let mainData: Record<string, any> | null = null;
    for (const obj of objs) {
      if (
        obj &&
        typeof obj === "object" &&
        !Array.isArray(obj) &&
        "header" in obj &&
        "summary" in obj
      ) {
        mainData = obj;
        break;
      }
    }
    if (!mainData) return null;

    const header = deepResolve(objs, resolveRef(objs, mainData.header));
    const summary = deepResolve(objs, resolveRef(objs, mainData.summary));

    // Use the "pick" build (most popular) from the summary
    const build = summary?.pick;
    if (!build) return null;

    return {
      winRate: header?.wr ?? 50,
      pickRate: header?.pr ?? 1,
      games: header?.n ?? 0,
      runes: {
        primaryTree: build.runes?.page?.pri ?? 0,
        secondaryTree: build.runes?.page?.sec ?? 0,
        primaryPerks: Array.isArray(build.runes?.set?.pri)
          ? build.runes.set.pri
          : [],
        secondaryPerks: Array.isArray(build.runes?.set?.sec)
          ? build.runes.set.sec
          : [],
      },
      coreItems: Array.isArray(build.items?.core?.set)
        ? build.items.core.set
        : [],
      item4: (build.items?.item4 ?? [])
        .map((x: any) => x?.id)
        .filter((id: any) => typeof id === "number"),
      item5: (build.items?.item5 ?? [])
        .map((x: any) => x?.id)
        .filter((id: any) => typeof id === "number"),
      item6: (build.items?.item6 ?? [])
        .map((x: any) => x?.id)
        .filter((id: any) => typeof id === "number"),
      skillPriority:
        typeof build.skillpriority?.id === "string"
          ? build.skillpriority.id
          : "",
      counters: {
        strong: Array.isArray(header?.counters?.strong)
          ? header.counters.strong
          : [],
        weak: Array.isArray(header?.counters?.weak)
          ? header.counters.weak
          : [],
      },
    };
  } catch (err) {
    console.warn(
      `  Failed to fetch ${champDDId} (${lane}):`,
      (err as Error).message
    );
    return null;
  }
}

// ─── Compile meta data ──────────────────────────────────────────────────

function getTier(winRate: number, pickRate: number): string {
  if (winRate >= 53 && pickRate >= 5) return "S+";
  if (winRate >= 52 && pickRate >= 3) return "S";
  if (winRate >= 51) return "A";
  if (winRate >= 49) return "B";
  if (winRate >= 47) return "C";
  return "D";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching current patch...");
  const patch = await getCurrentPatch();
  console.log(`Current patch: ${patch}`);

  console.log("Fetching champions, items, and runes from Data Dragon...");
  const [champions, itemMap, runeMap] = await Promise.all([
    getAllChampions(patch),
    getItemMap(patch),
    getRuneMap(patch),
  ]);
  console.log(
    `Loaded ${champions.size} champions, ${itemMap.size} items, ${runeMap.size} runes`
  );

  // Champion numeric key → display name (for resolving counter IDs)
  const champKeyToName = new Map<number, string>();
  for (const champ of champions.values()) {
    champKeyToName.set(Number(champ.key), champ.name);
  }

  const meta: Record<string, Record<string, ChampionMeta>> = {};
  let processed = 0;
  let scraped = 0;
  let failed = 0;

  for (const [champId, champ] of champions) {
    const roles = guessRoles(champ);

    for (const role of roles) {
      const lane = ROLE_TO_LANE[role] ?? role;
      const buildData = await fetchChampionBuild(champId, lane);

      let champMeta: ChampionMeta;

      if (buildData && buildData.games >= 100) {
        // ── Runes ──
        const primaryTree =
          RUNE_TREE_ORDER[buildData.runes.primaryTree] ?? "Unknown";
        const secondaryTree =
          RUNE_TREE_ORDER[buildData.runes.secondaryTree] ?? "Unknown";
        const perks = [
          ...buildData.runes.primaryPerks.map(
            (id) => runeMap.get(id) ?? `Rune ${id}`
          ),
          ...buildData.runes.secondaryPerks.map(
            (id) => runeMap.get(id) ?? `Rune ${id}`
          ),
        ];

        // ── Items: core 3 + best picks for slots 4-6 ──
        const coreItemNames = buildData.coreItems.map(
          (id) => itemMap.get(id) ?? `Item ${id}`
        );
        const coreIdSet = new Set(buildData.coreItems);
        const seen = new Set(coreItemNames);
        const items = [...coreItemNames];

        for (const pool of [
          buildData.item4,
          buildData.item5,
          buildData.item6,
        ]) {
          for (const id of pool) {
            const name = itemMap.get(id);
            if (name && !coreIdSet.has(id) && !seen.has(name)) {
              items.push(name);
              seen.add(name);
              break;
            }
          }
        }

        // ── Skill order ──
        const skillOrder = buildData.skillPriority
          ? buildData.skillPriority.split("")
          : [];

        // ── Matchups from counter data ──
        const matchups: Record<
          string,
          { winRate: number; games: number; difficulty: string }
        > = {};
        for (const key of buildData.counters.strong) {
          const name = champKeyToName.get(key);
          if (name) {
            matchups[name] = {
              winRate: 55,
              games: buildData.games,
              difficulty: "easy",
            };
          }
        }
        for (const key of buildData.counters.weak) {
          const name = champKeyToName.get(key);
          if (name) {
            matchups[name] = {
              winRate: 45,
              games: buildData.games,
              difficulty: "hard",
            };
          }
        }

        champMeta = {
          tier: getTier(buildData.winRate, buildData.pickRate),
          winRate: Math.round(buildData.winRate * 10) / 10,
          pickRate: Math.round(buildData.pickRate * 10) / 10,
          recommendedBuild: {
            runes: { primary: primaryTree, secondary: secondaryTree, perks },
            items,
            skillOrder,
          },
          matchups,
        };
        scraped++;
      } else {
        // Fallback when scrape fails or too few games
        champMeta = {
          tier: "B",
          winRate: 50,
          pickRate: 1,
          recommendedBuild: {
            runes: { primary: "TBD", secondary: "TBD", perks: [] },
            items: [],
            skillOrder: [],
          },
          matchups: {},
        };
        failed++;
      }

      if (!meta[champ.name]) meta[champ.name] = {};
      meta[champ.name][role] = champMeta;
    }

    processed++;
    if (processed % 10 === 0) {
      console.log(
        `Processed ${processed}/${champions.size} champions (${scraped} scraped, ${failed} fallback)...`
      );
    }

    // Rate limit: be respectful to Lolalytics
    await sleep(1500);
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
    `\nTotal: ${Object.keys(meta).length} champions, ${scraped} scraped, ${failed} fallback`
  );
}

main().catch(console.error);
