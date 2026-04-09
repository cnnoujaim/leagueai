import { EventEmitter } from "node:events";
import https from "node:https";
import type { LiveClientData } from "../game/types.js";

const API_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";

export class LiveClientPoller extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private snapshots: LiveClientData[] = [];

  start(pollIntervalMs = 30_000): void {
    this.snapshots = [];
    this.poll(); // Immediate first poll
    this.interval = setInterval(() => this.poll(), pollIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getSnapshots(): LiveClientData[] {
    return this.snapshots;
  }

  getLatest(): LiveClientData | null {
    return this.snapshots.at(-1) ?? null;
  }

  private poll(): void {
    const url = new URL(API_URL);

    const req = https.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        rejectUnauthorized: false, // Riot's Live Client uses a self-signed cert
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(body) as LiveClientData;
            this.snapshots.push(data);
            this.emit("data", data);
          } catch {
            // Invalid JSON — game may still be loading
          }
        });
      }
    );

    req.on("error", () => {
      // Game not running or API not available yet — expected
    });
  }
}
