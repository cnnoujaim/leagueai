import { Router } from "express";
import type { Request, Response } from "express";
import {
  buildMatchupPrompt,
  buildPostGamePrompt,
  buildInGameUpdatePrompt,
} from "../coaching/prompt-builder.js";
import { streamCoachingResponse } from "../coaching/claude-client.js";
import {
  getCacheKey,
  getCachedResponse,
  setCachedResponse,
} from "../coaching/cache.js";
import { getMetaData } from "../meta/data-service.js";
import type { MatchupRequest, PostGameRequest, InGameUpdateRequest } from "../coaching/types.js";

export const coachingRouter = Router();

coachingRouter.post("/matchup", async (req: Request, res: Response) => {
  const body = req.body as MatchupRequest;
  console.log("[coaching] Matchup request:", body.playerChampion, "vs", body.enemyChampion);

  if (!body.playerChampion) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Default missing fields for practice/test scenarios
  if (!body.enemyChampion || body.enemyChampion === "Unknown") {
    body.enemyChampion = "General";
  }
  if (!body.playerRole || body.playerRole === "none") {
    body.playerRole = "mid";
  }

  const cacheKey = getCacheKey(
    body.playerChampion,
    body.enemyChampion,
    body.playerRole,
    body.patch
  );

  // Check cache first
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    // Return cached response as a single SSE event
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ type: "text", content: cached })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
    return;
  }

  // Fetch meta data and build prompt
  const meta = await getMetaData(body.patch);
  const prompt = buildMatchupPrompt(body, meta);

  // Stream response via SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  console.log("[coaching] Calling Claude API...");
  try {
    let chunkCount = 0;
    for await (const chunk of streamCoachingResponse(prompt)) {
      chunkCount++;
      fullResponse += chunk;
      res.write(
        `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
      );
    }

    console.log(`[coaching] Done — ${chunkCount} chunks, ${fullResponse.length} chars`);

    // Cache the full response
    setCachedResponse(cacheKey, fullResponse);

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (error) {
    console.error("[coaching] Stream error:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", content: "Failed to generate coaching advice" })}\n\n`
    );
  }

  res.end();
});

coachingRouter.post("/update", async (req: Request, res: Response) => {
  const body = req.body as InGameUpdateRequest;
  console.log(`[coaching] In-game update at ${Math.floor(body.gameTime / 60)}min: ${body.playerChampion} vs ${body.enemyChampion}`);

  if (!body.playerChampion || !body.gameTime) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const prompt = buildInGameUpdatePrompt(body);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const chunk of streamCoachingResponse(prompt)) {
      res.write(
        `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
      );
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (error) {
    console.error("[coaching] Update stream error:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", content: "Failed to generate update" })}\n\n`
    );
  }

  res.end();
});

coachingRouter.post("/postgame", async (req: Request, res: Response) => {
  const body = req.body as PostGameRequest;

  if (!body.playerChampion || !body.gameStats) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const prompt = buildPostGamePrompt(body);

  // Stream response via SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const chunk of streamCoachingResponse(prompt)) {
      res.write(
        `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`
      );
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (error) {
    console.error("Post-game stream error:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", content: "Failed to generate post-game analysis" })}\n\n`
    );
  }

  res.end();
});
