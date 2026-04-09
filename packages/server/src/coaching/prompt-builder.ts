import type { MatchupRequest, PostGameRequest, InGameUpdateRequest, PatchMeta } from "./types.js";

const SYSTEM_PROMPT = `You are a League of Legends coaching assistant built into an in-game overlay. Your advice appears during the loading screen, so players need to read it in under 30 seconds.

CRITICAL RULES:
- You MUST use the PROVIDED CURRENT PATCH DATA for all build recommendations, win rates, and tier assessments.
- Do NOT rely on your training data for item builds, runes, or win rates — it may be outdated.
- If the provided data does not cover something, say so rather than guessing.
- Your training knowledge IS reliable for: champion ability mechanics, general lane strategies, macro concepts, team fight positioning, wave management theory.

FORMAT RULES:
- Be concise. Use short sentences and bullet points.
- No fluff, no disclaimers, no "as a coaching assistant" preamble.
- Use game-specific terminology the player would know.`;

export function buildMatchupPrompt(
  req: MatchupRequest,
  meta: PatchMeta | null
): string {
  const championMeta = meta?.champions[req.playerChampion]?.[req.playerRole];
  const matchupData = championMeta?.matchups[req.enemyChampion];

  let metaContext = "";
  if (championMeta) {
    metaContext += `\nCURRENT PATCH DATA (Patch ${req.patch}):`;
    metaContext += `\n- ${req.playerChampion} (${req.playerRole}) — Tier: ${championMeta.tier}, Win Rate: ${championMeta.winRate}%`;
    metaContext += `\n- Recommended Build: ${championMeta.recommendedBuild.items.join(" → ")}`;
    metaContext += `\n- Recommended Runes: ${championMeta.recommendedBuild.runes.primary} / ${championMeta.recommendedBuild.runes.secondary}`;
    metaContext += `\n- Skill Order: ${championMeta.recommendedBuild.skillOrder.join(" → ")}`;

    if (matchupData) {
      metaContext += `\n- ${req.playerChampion} vs ${req.enemyChampion} winrate: ${matchupData.winRate}% (${matchupData.games.toLocaleString()} games)`;
      metaContext += `\n- Matchup difficulty: ${matchupData.difficulty}`;
    }
  } else {
    metaContext +=
      "\nNote: No current patch meta data available for this champion/role. Use your general knowledge but caveat any build-specific advice.";
  }

  metaContext += `\n- Your team: ${req.teamComp.join(", ")}`;
  metaContext += `\n- Enemy team: ${req.enemyComp.join(", ")}`;

  const userPrompt = `${metaContext}

Provide a matchup briefing for ${req.playerChampion} (${req.playerRole}) vs ${req.enemyChampion} (${req.enemyRole}):

1. **GAME PLAN** (2-3 sentences): How to approach this lane matchup overall
2. **KEY ABILITIES TO WATCH**: Enemy abilities that are dangerous — what they do and when they come online
3. **COUNTERPLAY** (3-4 bullet points): Specific actions to take or avoid
4. **POWER SPIKES**: When you are strong vs when the enemy is strong (by level and items)
5. **TEAM FIGHT ROLE**: Your job in team fights given both team compositions`;

  return userPrompt;
}

export function buildPostGamePrompt(
  req: PostGameRequest
): string {
  const { gameStats, events } = req;
  const duration = Math.floor(gameStats.gameDuration / 60);

  let prompt = `POST-GAME ANALYSIS for ${req.playerChampion} (${req.playerRole}) vs ${req.enemyChampion}:

GAME RESULT: ${gameStats.win ? "VICTORY" : "DEFEAT"} (${duration} minutes)
KDA: ${gameStats.kills}/${gameStats.deaths}/${gameStats.assists}
CS: ${gameStats.cs} (${(gameStats.cs / duration).toFixed(1)} CS/min)
Final Items: ${gameStats.items.join(", ")}
Final Level: ${gameStats.level}

PRE-GAME BRIEFING GIVEN:
${req.matchupBriefing}`;

  if (events.length > 0) {
    prompt += `\n\nKEY EVENTS:\n${events.map((e) => `- ${Math.floor(e.timestamp / 60)}:${String(Math.floor(e.timestamp % 60)).padStart(2, "0")} ${e.type}`).join("\n")}`;
  }

  prompt += `\n\nProvide:
1. **WHAT WENT WELL** (2-3 bullet points)
2. **WHAT TO IMPROVE** (2-3 bullet points with specific, actionable advice)
3. **DID YOU FOLLOW THE GAME PLAN?** (Brief assessment based on the pre-game briefing)
4. **ONE KEY TAKEAWAY**: The single most impactful thing to focus on next game`;

  return prompt;
}

export function buildInGameUpdatePrompt(req: InGameUpdateRequest): string {
  const minutes = Math.floor(req.gameTime / 60);
  const p = req.playerStats;
  const e = req.enemyStats;

  let prompt = `IN-GAME UPDATE at ${minutes} minutes for ${req.playerChampion} (${req.playerRole}) vs ${req.enemyChampion} (${req.enemyRole}):

YOU: Level ${p.level} | ${p.kills}/${p.deaths}/${p.assists} KDA | ${p.cs} CS | ${p.gold} gold
Items: ${p.items.length > 0 ? p.items.join(", ") : "Starting items"}

ENEMY ${req.enemyChampion}: Level ${e.level} | ${e.kills}/${e.deaths}/${e.assists} KDA | ${e.cs} CS
Items: ${e.items.length > 0 ? e.items.join(", ") : "Starting items"}

Teams: ${req.teamComp.join(", ")} vs ${req.enemyComp.join(", ")}`;

  if (req.recentEvents.length > 0) {
    prompt += `\n\nRECENT EVENTS:\n${req.recentEvents.map(e => `- ${e}`).join("\n")}`;
  }

  prompt += `\n\nORIGINAL GAME PLAN:\n${req.previousBriefing}`;

  prompt += `\n\nGive a SHORT mid-game update (under 150 words). Include:
1. **STATUS**: Are you ahead, even, or behind? One sentence.
2. **ADJUST**: What should you do differently right now based on the game state? 2-3 bullet points.
3. **NEXT OBJECTIVE**: What should you focus on in the next few minutes?

Do NOT repeat the original game plan. Only give NEW advice based on the CURRENT game state.`;

  return prompt;
}

export { SYSTEM_PROMPT };
