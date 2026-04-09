import { readFile, access } from "node:fs/promises";
import { watch } from "node:fs";
import https from "node:https";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import type { LCUCredentials } from "../game/types.js";
import { getPlatformAdapter } from "../platform/adapter.js";

export class LCUConnector extends EventEmitter {
  private credentials: LCUCredentials | null = null;
  private ws: WebSocket | null = null;
  private fileWatcher: ReturnType<typeof watch> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private adapter = getPlatformAdapter();

  async start(): Promise<void> {
    // Try to find lockfile immediately
    const creds = await this.tryFindCredentials();
    if (creds) {
      this.onConnected(creds);
      return;
    }

    // Watch for lockfile creation and poll for process
    this.startWatching();
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
    this.fileWatcher?.close();
    this.fileWatcher = null;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.credentials = null;
  }

  getCredentials(): LCUCredentials | null {
    return this.credentials;
  }

  request(method: string, path: string): Promise<unknown> {
    if (!this.credentials) throw new Error("Not connected to LCU");

    const { port, password } = this.credentials;
    const auth = Buffer.from(`riot:${password}`).toString("base64");

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          rejectUnauthorized: false,
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`LCU ${method} ${path} failed: ${res.statusCode}`));
              return;
            }
            try { resolve(JSON.parse(body)); } catch { resolve(body); }
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
  }

  private async tryFindCredentials(): Promise<LCUCredentials | null> {
    // Strategy 1: Try lockfile paths
    for (const lockfilePath of this.adapter.getLockfilePaths()) {
      try {
        await access(lockfilePath);
        const content = await readFile(lockfilePath, "utf-8");
        const creds = this.parseLockfile(content);
        if (creds) return creds;
      } catch {
        // File doesn't exist, try next
      }
    }

    // Strategy 2: Try process discovery
    return this.adapter.discoverFromProcess();
  }

  private parseLockfile(content: string): LCUCredentials | null {
    // Lockfile format: processName:pid:port:password:protocol
    const parts = content.split(":");
    if (parts.length < 5) return null;

    return {
      pid: parseInt(parts[1], 10),
      port: parseInt(parts[2], 10),
      password: parts[3],
      protocol: parts[4],
    };
  }

  private startWatching(): void {
    // Watch common lockfile paths
    for (const lockfilePath of this.adapter.getLockfilePaths()) {
      try {
        const dir = lockfilePath.substring(0, lockfilePath.lastIndexOf("/"));
        this.fileWatcher = watch(dir, async (_, filename) => {
          if (filename === "lockfile") {
            const creds = await this.tryFindCredentials();
            if (creds) this.onConnected(creds);
          }
        });
      } catch {
        // Directory might not exist
      }
    }

    // Also poll for process every 5 seconds as fallback
    this.pollInterval = setInterval(async () => {
      const creds = await this.adapter.discoverFromProcess();
      if (creds) {
        this.onConnected(creds);
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    }, 5000);
  }

  private onConnected(credentials: LCUCredentials): void {
    this.credentials = credentials;
    this.emit("connected", credentials);
    this.connectWebSocket(credentials);
  }

  private connectWebSocket(credentials: LCUCredentials): void {
    const { port, password } = credentials;
    const auth = Buffer.from(`riot:${password}`).toString("base64");

    this.ws = new WebSocket(`wss://127.0.0.1:${port}`, {
      headers: { Authorization: `Basic ${auth}` },
      rejectUnauthorized: false,
    });

    this.ws.on("open", () => {
      console.log("LCU WebSocket connected");
      // Subscribe to game flow and champ select events
      this.ws?.send(
        JSON.stringify([
          5,
          "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase",
        ])
      );
      this.ws?.send(
        JSON.stringify([
          5,
          "OnJsonApiEvent_lol-champ-select_v1_session",
        ])
      );
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (Array.isArray(message) && message[0] === 8) {
          const [, eventName, eventData] = message;
          this.emit("lcu-event", { name: eventName, data: eventData });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.on("close", () => {
      console.log("LCU WebSocket disconnected");
      this.credentials = null;
      this.emit("disconnected");
      // Restart watching
      this.startWatching();
    });

    this.ws.on("error", (error) => {
      console.error("LCU WebSocket error:", error.message);
    });
  }
}
