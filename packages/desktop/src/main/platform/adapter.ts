import type { BrowserWindow } from "electron";
import type { LCUCredentials } from "../game/types.js";

export interface PlatformAdapter {
  getLockfilePaths(): string[];
  discoverFromProcess(): Promise<LCUCredentials | null>;
  configureOverlayWindow(win: BrowserWindow): void;
}

export function getPlatformAdapter(): PlatformAdapter {
  if (process.platform === "win32") {
    return new Win32Adapter();
  }
  return new DarwinAdapter();
}

class DarwinAdapter implements PlatformAdapter {
  getLockfilePaths(): string[] {
    return [
      "/Applications/League of Legends.app/Contents/LoL/lockfile",
    ];
  }

  async discoverFromProcess(): Promise<LCUCredentials | null> {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync("ps -A -o args | grep LeagueClientUx");
      const lines = stdout.split("\n").filter((l) => l.includes("--app-port"));

      for (const line of lines) {
        const port = line.match(/--app-port=(\d+)/)?.[1];
        const password = line.match(/--remoting-auth-token=([\w-]+)/)?.[1];
        const pid = line.match(/--app-pid=(\d+)/)?.[1];

        if (port && password) {
          return {
            port: parseInt(port, 10),
            password,
            protocol: "https",
            pid: pid ? parseInt(pid, 10) : 0,
          };
        }
      }
    } catch {
      // Process not found
    }

    return null;
  }

  configureOverlayWindow(win: BrowserWindow): void {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver", 1);
    win.setFullScreenable(false);
  }
}

class Win32Adapter implements PlatformAdapter {
  getLockfilePaths(): string[] {
    return [
      "C:\\Riot Games\\League of Legends\\lockfile",
      "D:\\Riot Games\\League of Legends\\lockfile",
    ];
  }

  async discoverFromProcess(): Promise<LCUCredentials | null> {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(
        'wmic PROCESS WHERE name="LeagueClientUx.exe" GET commandline'
      );
      const port = stdout.match(/--app-port=(\d+)/)?.[1];
      const password = stdout.match(/--remoting-auth-token=([\w-]+)/)?.[1];
      const pid = stdout.match(/--app-pid=(\d+)/)?.[1];

      if (port && password) {
        return {
          port: parseInt(port, 10),
          password,
          protocol: "https",
          pid: pid ? parseInt(pid, 10) : 0,
        };
      }
    } catch {
      // Process not found
    }

    return null;
  }

  configureOverlayWindow(win: BrowserWindow): void {
    win.setAlwaysOnTop(true, "screen-saver");
  }
}
