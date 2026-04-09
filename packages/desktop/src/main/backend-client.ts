import { EventEmitter } from "node:events";
import type { MatchupInfo } from "./game/game-flow-fsm.js";
import { getCurrentVersion } from "./riot/data-dragon.js";
import { getAccessToken } from "./auth.js";

const SERVER_URL =
  process.env.LEAGUEAI_SERVER_URL || "http://localhost:3001";

export class BackendClient extends EventEmitter {
  private getAuthHeaders(): Record<string, string> {
    const token = getAccessToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async requestMatchupCoaching(matchup: MatchupInfo): Promise<void> {
    const patch = await getCurrentVersion();

    const body = {
      playerChampion: matchup.playerChampion,
      playerRole: matchup.playerRole,
      enemyChampion: matchup.enemyChampion,
      enemyRole: matchup.enemyRole,
      teamComp: matchup.teamComp,
      enemyComp: matchup.enemyComp,
      patch,
    };

    try {
      const response = await fetch(`${SERVER_URL}/api/coaching/matchup`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.emit("error", `Server returned ${response.status}`);
        return;
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        this.emit("error", "No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const json = line.slice(6);
          try {
            const event = JSON.parse(json) as {
              type: string;
              content?: string;
            };

            if (event.type === "text") {
              this.emit("coaching-chunk", event.content);
            } else if (event.type === "done") {
              this.emit("coaching-done");
            } else if (event.type === "error") {
              this.emit("error", event.content);
            }
          } catch {
            // Malformed SSE event
          }
        }
      }
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async requestInGameUpdate(data: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(`${SERVER_URL}/api/coaching/update`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        this.emit("error", `Server returned ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
            };
            if (event.type === "text") {
              this.emit("update-chunk", event.content);
            } else if (event.type === "done") {
              this.emit("update-done");
            }
          } catch {
            // skip
          }
        }
      }
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async requestPostGameAnalysis(data: {
    playerChampion: string;
    playerRole: string;
    enemyChampion: string;
    matchupBriefing: string;
    gameStats: Record<string, unknown>;
    events: Array<{ timestamp: number; type: string; data: Record<string, unknown> }>;
  }): Promise<void> {
    try {
      const response = await fetch(`${SERVER_URL}/api/coaching/postgame`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        this.emit("error", `Server returned ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
            };
            if (event.type === "text") {
              this.emit("postgame-chunk", event.content);
            } else if (event.type === "done") {
              this.emit("postgame-done");
            }
          } catch {
            // skip
          }
        }
      }
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
