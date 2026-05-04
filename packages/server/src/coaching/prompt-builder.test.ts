import { describe, it, expect } from "vitest";
import {
  buildMatchupPrompt,
  buildPostGamePrompt,
  buildInGameUpdatePrompt,
} from "./prompt-builder.js";
import type { MatchupRequest, PostGameRequest, InGameUpdateRequest, PatchMeta, ChampionMeta } from "./types.js";

const championMeta: ChampionMeta = {
  tier: "S",
  winRate: 52.3,
  pickRate: 6.1,
  recommendedBuild: {
    runes: { primary: "Precision", secondary: "Resolve", perks: ["Conqueror", "Triumph"] },
    items: ["Eclipse", "Ionian Boots", "Sundered Sky"],
    skillOrder: ["Q", "E", "W"],
  },
  matchups: {
    Yasuo: { winRate: 47.8, games: 12345, difficulty: "Hard" },
  },
};

const meta: PatchMeta = {
  patch: "16.8.1",
  lastUpdated: "2026-05-04",
  champions: { Garen: { top: championMeta } },
};

const matchupReq: MatchupRequest = {
  playerChampion: "Garen",
  playerRole: "top",
  enemyChampion: "Yasuo",
  enemyRole: "top",
  teamComp: ["Garen", "LeeSin", "Ahri", "Jinx", "Thresh"],
  enemyComp: ["Yasuo", "Graves", "Zed", "Kaisa", "Leona"],
  patch: "16.8.1",
};

describe("buildMatchupPrompt", () => {
  it("includes patch data, build, runes (with perks), and matchup winrate when available", () => {
    const prompt = buildMatchupPrompt(matchupReq, meta);
    expect(prompt).toContain("CURRENT PATCH DATA (Patch 16.8.1)");
    expect(prompt).toContain("Tier: S, Win Rate: 52.3%");
    expect(prompt).toContain("Eclipse → Ionian Boots → Sundered Sky");
    expect(prompt).toContain("Precision / Resolve");
    expect(prompt).toContain("(Conqueror, Triumph)");
    expect(prompt).toContain("Q → E → W");
    expect(prompt).toContain("Garen vs Yasuo winrate: 47.8% (12,345 games)");
    expect(prompt).toContain("Matchup difficulty: Hard");
    expect(prompt).toContain("Your team: Garen, LeeSin, Ahri, Jinx, Thresh");
  });

  it("falls back to general-knowledge prompt when no meta data exists", () => {
    const prompt = buildMatchupPrompt(matchupReq, null);
    expect(prompt).toContain("no curated build data available");
    expect(prompt).not.toContain("CURRENT PATCH DATA");
  });

  it("falls back to general-knowledge prompt when build is TBD/empty", () => {
    const stubMeta: PatchMeta = {
      patch: "16.8.1",
      lastUpdated: "2026-05-04",
      champions: {
        Garen: {
          top: {
            ...championMeta,
            recommendedBuild: { runes: { primary: "TBD", secondary: "TBD", perks: [] }, items: [], skillOrder: [] },
          },
        },
      },
    };
    const prompt = buildMatchupPrompt(matchupReq, stubMeta);
    expect(prompt).toContain("no curated build data available");
  });
});

describe("buildPostGamePrompt", () => {
  it("renders KDA, CS/min, items, and the original briefing", () => {
    const req: PostGameRequest = {
      playerChampion: "Garen",
      playerRole: "top",
      enemyChampion: "Yasuo",
      matchupBriefing: "Play safe early, scale into mid-game.",
      gameStats: {
        kills: 8, deaths: 3, assists: 5,
        cs: 210, gameDuration: 1800, win: true,
        items: ["Eclipse", "Sundered Sky"], level: 16,
      },
      events: [
        { timestamp: 600, type: "FIRST_BLOOD", data: {} },
        { timestamp: 1200, type: "DRAGON", data: {} },
      ],
    };
    const prompt = buildPostGamePrompt(req);
    expect(prompt).toContain("VICTORY");
    expect(prompt).toContain("KDA: 8/3/5");
    expect(prompt).toContain("CS: 210 (7.0 CS/min)");
    expect(prompt).toContain("Play safe early, scale into mid-game.");
    expect(prompt).toContain("10:00 FIRST_BLOOD");
    expect(prompt).toContain("20:00 DRAGON");
  });
});

describe("buildInGameUpdatePrompt", () => {
  const baseReq: InGameUpdateRequest = {
    playerChampion: "Garen",
    playerRole: "top",
    enemyChampion: "Yasuo",
    enemyRole: "top",
    teamComp: ["Garen", "LeeSin", "Ahri", "Jinx", "Thresh"],
    enemyComp: ["Yasuo", "Graves", "Zed", "Kaisa", "Leona"],
    gameTime: 900,
    playerStats: { level: 9, kills: 2, deaths: 1, assists: 1, cs: 110, gold: 1450, items: ["Eclipse"] },
    enemyStats: { level: 9, kills: 1, deaths: 2, assists: 1, cs: 95, gold: 4200, items: ["Stridebreaker"] },
    teamGoldSpent: 18500,
    enemyGoldSpent: 16200,
    recentEvents: ["10:30 — DRAGON_KILL"],
    previousBriefing: "Play safe early.",
  };

  it("renders the enemy spent-gold and team gold lead", () => {
    const prompt = buildInGameUpdatePrompt(baseReq, meta);
    expect(prompt).toContain("~4,200g spent on items");
    expect(prompt).toContain("your team 18,500g vs enemy 16,200g");
    expect(prompt).toContain("AHEAD by 2,300g");
  });

  it("flips the gold-lead label when behind", () => {
    const prompt = buildInGameUpdatePrompt({ ...baseReq, teamGoldSpent: 10000, enemyGoldSpent: 15000 }, meta);
    expect(prompt).toContain("BEHIND by 5,000g");
  });

  it("renders 'even' when team gold is tied", () => {
    const prompt = buildInGameUpdatePrompt({ ...baseReq, teamGoldSpent: 12000, enemyGoldSpent: 12000 }, meta);
    expect(prompt).toContain("your team is even");
  });

  it("includes the recommended build path when meta data exists", () => {
    const prompt = buildInGameUpdatePrompt(baseReq, meta);
    expect(prompt).toContain("RECOMMENDED BUILD PATH: Eclipse → Ionian Boots → Sundered Sky");
  });

  it("omits build path when meta is null", () => {
    const prompt = buildInGameUpdatePrompt(baseReq, null);
    expect(prompt).not.toContain("RECOMMENDED BUILD PATH");
  });
});
