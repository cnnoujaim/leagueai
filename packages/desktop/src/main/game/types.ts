export type GameFlowPhase =
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "GameStart"
  | "InProgress"
  | "WaitingForStats"
  | "EndOfGame"
  | "TerminatedInError"
  | "Reconnect";

// Supported game modes for coaching
export type GameMode = "CLASSIC" | "ARAM" | "CHERRY" | "NEXUSBLITZ" | "UNKNOWN";

export const SUPPORTED_MODES: GameMode[] = ["CLASSIC"];

export interface ChampSelectState {
  localPlayerCellId: number;
  myTeam: ChampSelectPlayer[];
  theirTeam: ChampSelectPlayer[];
  timer: {
    phase: string;
    adjustedTimeLeftInPhase: number;
  };
}

export interface ChampSelectPlayer {
  cellId: number;
  championId: number;
  assignedPosition: string;
  summonerId: number;
  spell1Id: number;
  spell2Id: number;
}

export interface LCUCredentials {
  port: number;
  password: string;
  protocol: string;
  pid: number;
}

export interface LiveClientData {
  activePlayer: {
    summonerName: string;
    level: number;
    currentGold: number;
    championStats: Record<string, number>;
  };
  allPlayers: LivePlayerData[];
  events: { Events: LiveGameEvent[] };
  gameData: {
    gameMode: string;
    gameTime: number;
    mapName: string;
    mapNumber: number;
    mapTerrain: string;
  };
}

export interface LivePlayerData {
  championName: string;
  isBot: boolean;
  isDead: boolean;
  items: { itemID: number; displayName: string; count: number }[];
  level: number;
  position: string;
  scores: {
    kills: number;
    deaths: number;
    assists: number;
    creepScore: number;
  };
  summonerName: string;
  team: "ORDER" | "CHAOS";
}

export interface LiveGameEvent {
  EventID: number;
  EventName: string;
  EventTime: number;
  [key: string]: unknown;
}
