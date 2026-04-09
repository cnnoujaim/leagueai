export interface MatchupRequest {
  playerChampion: string;
  playerRole: string;
  enemyChampion: string;
  enemyRole: string;
  teamComp: string[];
  enemyComp: string[];
  patch: string;
}

export interface PostGameRequest {
  playerChampion: string;
  playerRole: string;
  enemyChampion: string;
  matchupBriefing: string;
  gameStats: {
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gameDuration: number;
    win: boolean;
    items: string[];
    level: number;
  };
  events: GameEvent[];
}

export interface GameEvent {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface InGameUpdateRequest {
  playerChampion: string;
  playerRole: string;
  enemyChampion: string;
  enemyRole: string;
  teamComp: string[];
  enemyComp: string[];
  gameTime: number;
  playerStats: {
    level: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gold: number;
    items: string[];
  };
  enemyStats: {
    level: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    items: string[];
  };
  recentEvents: string[];
  previousBriefing: string;
}

export interface ChampionMeta {
  tier: string;
  winRate: number;
  pickRate: number;
  recommendedBuild: {
    runes: { primary: string; secondary: string; perks: string[] };
    items: string[];
    skillOrder: string[];
  };
  matchups: Record<
    string,
    {
      winRate: number;
      games: number;
      difficulty: string;
    }
  >;
}

export interface PatchMeta {
  patch: string;
  lastUpdated: string;
  champions: Record<string, Record<string, ChampionMeta>>;
}
