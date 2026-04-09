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
    const paths = [
      "C:\\Riot Games\\League of Legends\\lockfile",
      "D:\\Riot Games\\League of Legends\\lockfile",
    ];

    // Check the Riot Client install path from registry-written config
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      paths.push(
        `${localAppData}\\Riot Games\\League of Legends\\lockfile`
      );
    }

    const programFiles = process.env["ProgramFiles(x86)"] ?? process.env.ProgramFiles;
    if (programFiles) {
      paths.push(`${programFiles}\\Riot Games\\League of Legends\\lockfile`);
    }

    return paths;
  }

  async discoverFromProcess(): Promise<LCUCredentials | null> {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    try {
      // Use PowerShell Get-CimInstance instead of deprecated wmic
      const { stdout } = await execAsync(
        'powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'LeagueClientUx.exe\'\\" | Select-Object -ExpandProperty CommandLine"'
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
    win.setSkipTaskbar(true);
    win.setFullScreenable(false);
  }
}
