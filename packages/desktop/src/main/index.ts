import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } from "electron";
import path from "node:path";
import { config } from "dotenv";

// In dev, load .env from repo root. In packaged builds, env vars are embedded via electron-vite define.
config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });
import { LCUConnector } from "./riot/lcu-connector.js";
import { LiveClientPoller } from "./riot/live-client-poller.js";
import { GameFlowFSM } from "./game/game-flow-fsm.js";
import { BackendClient } from "./backend-client.js";
import { getPlatformAdapter } from "./platform/adapter.js";
import { IPC } from "./ipc/channels.js";
import { signInWithGoogle, signOut, getStoredSession } from "./auth.js";

// Prevent EPIPE crashes when stdout/stderr pipes are broken
// (common when Electron is launched via npm scripts)
process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});
process.on("uncaughtException", (err) => {
  if ((err as NodeJS.ErrnoException).code === "EPIPE") return;
  throw err;
});

function log(...args: unknown[]): void {
  try { console.log(...args); } catch {}
}

function logError(...args: unknown[]): void {
  try { console.error(...args); } catch {}
}

let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const lcu = new LCUConnector();
const liveClient = new LiveClientPoller();
const backendClient = new BackendClient();
let gameFlow: GameFlowFSM;
let currentMatchupBriefing = "";
let currentMatchup: { playerChampion: string; playerRole: string; enemyChampion: string; enemyRole: string; teamComp: string[]; enemyComp: string[] } | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let zOrderInterval: ReturnType<typeof setInterval> | null = null;

function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const adapter = getPlatformAdapter();

  const win = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    type: process.platform === "darwin" ? "panel" : undefined,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  adapter.configureOverlayWindow(win);
  win.setIgnoreMouseEvents(true, { forward: true });

  // Re-raise overlay whenever it loses z-order (e.g., League steals focus)
  win.on("hide", () => {
    win.showInactive();
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

function createTray(): void {
  const iconPath = path.join(__dirname, "../../resources/icons/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  // Windows tray icons should be 16x16; resize to avoid blurry scaling
  const trayIcon = process.platform === "win32"
    ? icon.resize({ width: 16, height: 16 })
    : icon;
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Overlay",
      click: () => overlayWindow?.showInactive(),
    },
    {
      label: "Hide Overlay",
      click: () => overlayWindow?.hide(),
    },
    { type: "separator" },
    {
      label: "Quit League AI",
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip("League AI");
  tray.setContextMenu(contextMenu);
}

function setupIPC(): void {
  ipcMain.on(IPC.SET_IGNORE_MOUSE, (_, ignore: boolean) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.on(IPC.SHOW_OVERLAY, () => overlayWindow?.showInactive());
  ipcMain.on(IPC.HIDE_OVERLAY, () => overlayWindow?.hide());

  // Auth handlers
  ipcMain.handle("auth:sign-in-google", async () => {
    try {
      const result = await signInWithGoogle();
      overlayWindow?.webContents.send("auth:changed", result.user);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign-in failed" };
    }
  });

  ipcMain.handle("auth:sign-out", () => {
    signOut();
    overlayWindow?.webContents.send("auth:changed", null);
  });

  ipcMain.handle("auth:get-user", async () => {
    const session = await getStoredSession();
    return session ? session.user : null;
  });
}

function setupGameFlow(): void {
  gameFlow = new GameFlowFSM(lcu);

  // Forward phase changes to renderer
  gameFlow.on("phase", (phase: string) => {
    overlayWindow?.webContents.send(IPC.GAME_FLOW_CHANGED, phase);
  });

  // When matchup is locked in, request coaching
  gameFlow.on("matchup-locked", async (matchup) => {
    log(`Requesting coaching for matchup (${matchup.gameMode}):`, matchup);
    currentMatchupBriefing = "";
    currentMatchup = matchup;
    overlayWindow?.showInactive();
    await backendClient.requestMatchupCoaching(matchup);

    // Start 5-minute update cycle
    startUpdateCycle();
  });

  // When game mode is unsupported, log and skip
  gameFlow.on("unsupported-mode", (mode: string) => {
    log(`Unsupported game mode: ${mode} — coaching disabled for this game`);
  });

  // When game starts, poll live client data to resolve the actual matchup
  let matchupResolved = false;
  gameFlow.on("game-start", () => {
    matchupResolved = false;
    liveClient.start(5_000); // Poll every 5s until matchup is resolved
  });

  liveClient.on("data", (data) => {
    if (!matchupResolved) {
      gameFlow.resolveMatchupFromLiveData(data);
      matchupResolved = true;
      // Slow down polling now that matchup is resolved
      liveClient.stop();
      liveClient.start(30_000);
    }

    // Forward live stats to renderer for the scoreboard
    forwardLiveStats(data);
  });

  // Keep overlay on top while in game (League reasserts z-order)
  gameFlow.on("game-start", () => {
    if (zOrderInterval) clearInterval(zOrderInterval);
    zOrderInterval = setInterval(() => {
      if (!overlayWindow) return;
      overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
      if (!overlayWindow.isVisible()) {
        overlayWindow.showInactive();
      }
    }, 2_000);
  });

  // When game ends, stop polling and updates
  gameFlow.on("game-end", () => {
    liveClient.stop();
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    if (zOrderInterval) {
      clearInterval(zOrderInterval);
      zOrderInterval = null;
    }
  });
}

function startUpdateCycle(): void {
  if (updateInterval) clearInterval(updateInterval);

  // Request an update every 5 minutes
  updateInterval = setInterval(async () => {
    const liveData = liveClient.getLatest();
    if (!liveData || !currentMatchup) return;

    const me = liveData.allPlayers.find(
      (p) => p.summonerName === liveData.activePlayer.summonerName
    );
    if (!me) return;

    const enemy = liveData.allPlayers.find(
      (p) => p.team !== me.team && p.championName === currentMatchup!.enemyChampion
    ) ?? liveData.allPlayers.find((p) => p.team !== me.team);

    // Gather recent events from the last 5 minutes
    const gameTime = liveData.gameData.gameTime;
    const recentEvents = liveData.events.Events
      .filter((e) => e.EventTime > gameTime - 300)
      .map((e) => {
        const min = Math.floor(e.EventTime / 60);
        const sec = String(Math.floor(e.EventTime % 60)).padStart(2, "0");
        return `${min}:${sec} — ${e.EventName}`;
      });

    log(`Requesting in-game update at ${Math.floor(gameTime / 60)}min`);

    await backendClient.requestInGameUpdate({
      playerChampion: currentMatchup.playerChampion,
      playerRole: currentMatchup.playerRole,
      enemyChampion: currentMatchup.enemyChampion,
      enemyRole: currentMatchup.enemyRole,
      teamComp: currentMatchup.teamComp,
      enemyComp: currentMatchup.enemyComp,
      gameTime,
      playerStats: {
        level: me.level,
        kills: me.scores.kills,
        deaths: me.scores.deaths,
        assists: me.scores.assists,
        cs: me.scores.creepScore,
        gold: liveData.activePlayer.currentGold,
        items: me.items.map((i) => i.displayName),
      },
      enemyStats: {
        level: enemy?.level ?? 0,
        kills: enemy?.scores.kills ?? 0,
        deaths: enemy?.scores.deaths ?? 0,
        assists: enemy?.scores.assists ?? 0,
        cs: enemy?.scores.creepScore ?? 0,
        items: enemy?.items.map((i) => i.displayName) ?? [],
      },
      recentEvents,
      previousBriefing: currentMatchupBriefing,
    });
  }, 5 * 60 * 1000);
}

function forwardLiveStats(data: import("./game/types.js").LiveClientData): void {
  const me = data.allPlayers.find(
    (p) => p.summonerName === data.activePlayer.summonerName
  );
  if (!me) return;

  const myTeam = data.allPlayers.filter((p) => p.team === me.team);
  const enemyTeam = data.allPlayers.filter((p) => p.team !== me.team);

  const mapPlayer = (p: import("./game/types.js").LivePlayerData, isSelf: boolean) => ({
    championName: p.championName,
    level: p.level,
    kills: p.scores.kills,
    deaths: p.scores.deaths,
    assists: p.scores.assists,
    cs: p.scores.creepScore,
    gold: isSelf ? data.activePlayer.currentGold : undefined,
    items: p.items.map((i) => i.displayName),
    isDead: p.isDead,
    summonerName: p.summonerName,
  });

  overlayWindow?.webContents.send(IPC.LIVE_STATS_UPDATE, {
    gameTime: data.gameData.gameTime,
    player: mapPlayer(me, true),
    myTeam: myTeam.map((p) => mapPlayer(p, p.summonerName === me.summonerName)),
    enemyTeam: enemyTeam.map((p) => mapPlayer(p, false)),
  });
}

function setupBackendClient(): void {
  backendClient.on("coaching-chunk", (text: string) => {
    currentMatchupBriefing += text;
    if (currentMatchupBriefing.length <= 50) {
      log("First coaching chunk received:", text.slice(0, 50));
    }
    overlayWindow?.webContents.send(IPC.COACHING_TEXT_CHUNK, text);
  });

  backendClient.on("coaching-done", () => {
    log("Coaching complete —", currentMatchupBriefing.length, "chars");
    overlayWindow?.webContents.send(IPC.COACHING_DONE);
  });

  backendClient.on("update-chunk", (text: string) => {
    overlayWindow?.webContents.send(IPC.COACHING_UPDATE_CHUNK, text);
  });

  backendClient.on("update-done", () => {
    log("In-game update complete");
    overlayWindow?.webContents.send(IPC.COACHING_UPDATE_DONE);
  });

  backendClient.on("error", (error: string) => {
    logError("Backend error:", error);
    overlayWindow?.webContents.send(IPC.COACHING_ERROR, error);
  });
}

app.whenReady().then(() => {
  // Hide dock icon — makes macOS treat this as a background accessory app
  // so its windows stay above other apps (including borderless games)
  if (process.platform === "darwin") {
    app.dock.hide();
  }

  overlayWindow = createOverlayWindow();

  // Show overlay on startup so user can sign in
  overlayWindow.showInactive();

  // Tray creation may fail if icon doesn't exist yet — that's OK for dev
  try {
    createTray();
  } catch (e) {
    log("Tray icon not found, skipping tray:", e);
  }

  setupIPC();
  setupBackendClient();
  setupGameFlow();

  // Start looking for League client
  lcu.start().then(() => {
    log("LCU connector started");
  });

  lcu.on("connected", async () => {
    log("Connected to League client");

    // Check if we're already in a game (app started mid-game)
    try {
      const phase = await lcu.request("GET", "/lol-gameflow/v1/gameflow-phase") as string;
      log("Current game phase:", phase);
      if (phase === "InProgress") {
        log("Already in game — polling live client for matchup");
        liveClient.start(5_000);
      }
    } catch {
      // Not in game, that's fine
    }
  });

  lcu.on("disconnected", () => {
    log("Disconnected from League client");
  });
});

app.on("window-all-closed", () => {
  // Keep app running in tray on both macOS and Windows —
  // the overlay is the only window and hiding it shouldn't quit the app
});

app.on("before-quit", () => {
  lcu.stop();
  liveClient.stop();
});
