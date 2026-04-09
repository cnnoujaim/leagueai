import cron from "node-cron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { clearMetaCache } from "../meta/data-service.js";

const execAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: scripts/ is at repo root; in production (Docker): scripts/ is at /app/scripts/
const SCRIPT_PATH = process.env.NODE_ENV === "production"
  ? join(__dirname, "..", "scripts", "update-meta.ts")
  : join(__dirname, "..", "..", "..", "..", "scripts", "update-meta.ts");

export function startMetaCron(): void {
  // Run every night at 3:00 AM UTC
  cron.schedule("0 3 * * *", async () => {
    console.log("[cron] Starting nightly meta data update...");

    try {
      const { stdout, stderr } = await execAsync("npx", ["tsx", SCRIPT_PATH], {
        timeout: 300_000, // 5 minute timeout
      });

      if (stdout) console.log("[cron] update-meta stdout:", stdout);
      if (stderr) console.error("[cron] update-meta stderr:", stderr);

      // Clear the in-memory cache so the server picks up new data
      clearMetaCache();

      console.log("[cron] Meta data update complete");
    } catch (error) {
      console.error("[cron] Meta data update failed:", error);
    }
  });

  console.log("Meta data cron scheduled: every night at 3:00 AM UTC");
}
