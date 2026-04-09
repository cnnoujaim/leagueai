import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// In production, env vars are set by the hosting platform.
// In development, load from .env at repo root.
if (process.env.NODE_ENV !== "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  config({ path: join(__dirname, "..", "..", "..", ".env") });
}
import express from "express";
import cors from "cors";
import { coachingRouter } from "./routes/coaching.js";
import { metaRouter } from "./routes/meta.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";
import { coachingRateLimit } from "./middleware/rate-limit.js";
import { startMetaCron } from "./cron/meta-updater.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public routes
app.use("/api/auth", authRouter);
app.use("/api/meta", metaRouter);

// Protected routes
app.use("/api/coaching", requireAuth, coachingRateLimit, coachingRouter);

// Dev-only: unprotected coaching for testing (remove in production)
if (process.env.NODE_ENV !== "production") {
  app.use("/api/test/coaching", coachingRouter);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`League AI server running on port ${PORT}`);
  startMetaCron();
});
