import rateLimit from "express-rate-limit";
import type { AuthenticatedRequest } from "./auth.js";

// 30 coaching requests per hour per user (free tier)
// Accounts for: 1 matchup briefing + up to ~6 mid-game updates per game
export const coachingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req) => (req as AuthenticatedRequest).userId || req.ip || "unknown",
  message: {
    error: "Rate limit exceeded. Free tier allows 10 coaching requests per hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
