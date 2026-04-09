import { EventEmitter } from "node:events";
import type {
  GameFlowPhase,
  GameMode,
  ChampSelectState,
  LiveClientData,
} from "./types.js";
import { SUPPORTED_MODES } from "./types.js";
import type { LCUConnector } from "../riot/lcu-connector.js";
import { getChampionName } from "../riot/data-dragon.js";

export interface MatchupInfo {
  playerChampion: string;
  playerRole: string;
  enemyChampion: string;
  enemyRole: string;
  teamComp: string[];
  enemyComp: string[];
  gameMode: GameMode;
}

export class GameFlowFSM extends EventEmitter {
  private currentPhase: GameFlowPhase = "None";
  private lcu: LCUConnector;
  private finalizationHandled = false;
  private currentGameMode: GameMode = "UNKNOWN";

  // Stored from champ select, completed once in-game
  private pendingPlayerChampion = "";
  private pendingPlayerRole = "";
  private pendingTeamComp: string[] = [];

  constructor(lcu: LCUConnector) {
    super();
    this.lcu = lcu;
    this.setupListeners();
  }

  getCurrentPhase(): GameFlowPhase {
    return this.currentPhase;
  }

  getGameMode(): GameMode {
    return this.currentGameMode;
  }

  isSupportedMode(): boolean {
    return SUPPORTED_MODES.includes(this.currentGameMode);
  }

  private setupListeners(): void {
    this.lcu.on("lcu-event", async ({ name, data }) => {
      if (name === "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase") {
        this.handlePhaseChange(data.data as GameFlowPhase);
      }

      if (name === "OnJsonApiEvent_lol-champ-select_v1_session") {
        await this.handleChampSelect(data.data as ChampSelectState);
      }
    });

    this.lcu.on("disconnected", () => {
      this.currentPhase = "None";
      this.finalizationHandled = false;
      this.pendingPlayerChampion = "";
      this.emit("phase", "None");
    });
  }

  private async handlePhaseChange(phase: GameFlowPhase): Promise<void> {
    const previous = this.currentPhase;
    this.currentPhase = phase;

    console.log(`Game flow: ${previous} → ${phase}`);
    this.emit("phase", phase, previous);

    // Detect game mode when entering lobby or champ select
    if (phase === "Lobby" || phase === "ChampSelect") {
      await this.detectGameMode();
    }

    if (phase === "ChampSelect") {
      this.finalizationHandled = false;
      this.pendingPlayerChampion = "";
    }

    if (phase === "InProgress") {
      this.emit("game-start");
    }

    if (phase === "WaitingForStats" || phase === "EndOfGame") {
      this.emit("game-end");
    }

    if (phase === "None") {
      this.currentGameMode = "UNKNOWN";
    }
  }

  private async detectGameMode(): Promise<void> {
    try {
      const session = await this.lcu.request(
        "GET",
        "/lol-gameflow/v1/session"
      ) as { gameData?: { queue?: { gameMode?: string } }; map?: { gameMode?: string } };

      const mode =
        session?.gameData?.queue?.gameMode ??
        session?.map?.gameMode ??
        "UNKNOWN";

      this.currentGameMode = resolveGameMode(mode);
      console.log(`Game mode detected: ${this.currentGameMode} (raw: ${mode})`);
    } catch {
      this.currentGameMode = "UNKNOWN";
    }
  }

  /**
   * During champ select, just store our champion and team comp.
   * We don't request coaching yet — enemy matchup isn't reliable.
   */
  private async handleChampSelect(
    session: ChampSelectState
  ): Promise<void> {
    if (session.timer.phase !== "FINALIZATION" || this.finalizationHandled) {
      return;
    }
    this.finalizationHandled = true;

    if (!this.isSupportedMode()) {
      console.log(`Skipping coaching — unsupported mode: ${this.currentGameMode}`);
      return;
    }

    const localCellId = session.localPlayerCellId;
    const localPlayer = session.myTeam.find(
      (p) => p.cellId === localCellId
    );
    if (!localPlayer || !localPlayer.championId) return;

    this.pendingPlayerChampion = await getChampionName(
      localPlayer.championId
    );
    this.pendingPlayerRole = normalizeRole(localPlayer.assignedPosition);
    this.pendingTeamComp = await Promise.all(
      session.myTeam
        .filter((p) => p.championId)
        .map((p) => getChampionName(p.championId))
    );

    console.log(
      `Champ select locked: ${this.pendingPlayerChampion} (${this.pendingPlayerRole})`
    );
  }

  /**
   * Called once Live Client Data is available (game loaded).
   * Resolves the actual lane opponent and fires matchup-locked.
   */
  resolveMatchupFromLiveData(liveData: LiveClientData): void {
    // Confirm game mode from live data if we didn't get it from LCU
    if (this.currentGameMode === "UNKNOWN") {
      this.currentGameMode = resolveGameMode(liveData.gameData.gameMode);
      console.log(`Game mode from live data: ${this.currentGameMode}`);
    }

    if (!this.isSupportedMode()) {
      console.log(`Skipping coaching — unsupported mode: ${this.currentGameMode}`);
      this.emit("unsupported-mode", this.currentGameMode);
      return;
    }

    const playerName = liveData.activePlayer.summonerName;
    const allPlayers = liveData.allPlayers;

    // Find our player entry to get our team
    const me = allPlayers.find((p) => p.summonerName === playerName);
    if (!me) return;

    const myTeam = me.team;
    const myPosition = normalizeRole(me.position || this.pendingPlayerRole);

    const enemies = allPlayers.filter((p) => p.team !== myTeam);
    const teammates = allPlayers.filter(
      (p) => p.team === myTeam && p.summonerName !== playerName
    );

    // Find enemy in same role, or fall back to first enemy
    const enemyLaner =
      enemies.find(
        (p) => normalizeRole(p.position) === myPosition
      ) ?? enemies[0];

    const enemyChampion = enemyLaner?.championName ?? "Unknown";
    const enemyRole = enemyLaner
      ? normalizeRole(enemyLaner.position)
      : myPosition;

    const enemyComp = enemies.map((p) => p.championName);
    const teamComp =
      this.pendingTeamComp.length > 0
        ? this.pendingTeamComp
        : [me.championName, ...teammates.map((p) => p.championName)];

    const matchup: MatchupInfo = {
      playerChampion: this.pendingPlayerChampion || me.championName,
      playerRole: myPosition,
      enemyChampion,
      enemyRole,
      teamComp,
      enemyComp,
      gameMode: this.currentGameMode,
    };

    console.log(
      `Matchup resolved: ${matchup.playerChampion} (${myPosition}) vs ${enemyChampion} (${enemyRole})`
    );
    this.emit("matchup-locked", matchup);

    // Clear so we don't fire again
    this.pendingPlayerChampion = "";
  }
}

function resolveGameMode(raw: string): GameMode {
  const upper = raw.toUpperCase();
  const map: Record<string, GameMode> = {
    CLASSIC: "CLASSIC",       // Summoner's Rift (normal, ranked, draft, swiftplay)
    SWIFTPLAY: "CLASSIC",     // Swiftplay is SR with shorter games
    ARAM: "ARAM",
    CHERRY: "CHERRY",         // Arena (2v2v2v2)
    NEXUSBLITZ: "NEXUSBLITZ",
    PRACTICETOOL: "CLASSIC",
    TUTORIAL: "CLASSIC",
  };
  return map[upper] ?? "UNKNOWN";
}

function normalizeRole(position: string): string {
  const map: Record<string, string> = {
    top: "top",
    jungle: "jungle",
    middle: "mid",
    mid: "mid",
    bottom: "adc",
    adc: "adc",
    utility: "support",
    support: "support",
  };
  return map[position.toLowerCase()] ?? position.toLowerCase();
}
