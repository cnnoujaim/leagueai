import { create } from "zustand";

export interface PlayerStats {
  championName: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold?: number;
  items: string[];
  isDead: boolean;
  summonerName: string;
}

export interface LiveStatsSnapshot {
  gameTime: number;
  player: PlayerStats;
  myTeam: PlayerStats[];
  enemyTeam: PlayerStats[];
}

interface GameState {
  phase: string;
  coachingText: string;
  isCoachingDone: boolean;
  isCoachingLoading: boolean;
  coachingError: string | null;
  isExpanded: boolean;
  updateText: string;
  isUpdateLoading: boolean;
  isUpdateDone: boolean;
  liveStats: LiveStatsSnapshot | null;

  setPhase: (phase: string) => void;
  appendCoachingText: (text: string) => void;
  setCoachingDone: () => void;
  setCoachingError: (error: string) => void;
  setFullCoachingText: (text: string) => void;
  resetCoaching: () => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  appendUpdateText: (text: string) => void;
  setUpdateDone: () => void;
  setLiveStats: (stats: LiveStatsSnapshot) => void;
}

const AUTO_MINIMIZE_MS = 30 * 1000; // 30 seconds after each update completes
let minimizeTimer: ReturnType<typeof setTimeout> | null = null;

function startMinimizeTimer(set: (partial: Partial<GameState>) => void) {
  clearMinimizeTimer();
  minimizeTimer = setTimeout(() => {
    set({ isExpanded: false });
  }, AUTO_MINIMIZE_MS);
}

function clearMinimizeTimer() {
  if (minimizeTimer) {
    clearTimeout(minimizeTimer);
    minimizeTimer = null;
  }
}

export const useGameStore = create<GameState>((set) => ({
  phase: "None",
  coachingText: "",
  isCoachingDone: false,
  isCoachingLoading: false,
  coachingError: null,
  isExpanded: true,
  updateText: "",
  isUpdateLoading: false,
  isUpdateDone: false,
  liveStats: null,

  setPhase: (phase) => set({ phase }),

  appendCoachingText: (text) => {
    clearMinimizeTimer();
    set((state) => ({
      coachingText: state.coachingText + text,
      isCoachingLoading: true,
      isExpanded: true,
    }));
  },

  setCoachingDone: () => {
    startMinimizeTimer(set);
    set({ isCoachingDone: true, isCoachingLoading: false });
  },

  setCoachingError: (error) =>
    set({ coachingError: error, isCoachingLoading: false }),

  setFullCoachingText: (text) => {
    startMinimizeTimer(set); // cached response — already complete, start timer immediately
    set({
      coachingText: text,
      isCoachingDone: true,
      isCoachingLoading: false,
      isExpanded: true,
    });
  },

  resetCoaching: () => {
    clearMinimizeTimer();
    set({
      coachingText: "",
      isCoachingDone: false,
      isCoachingLoading: false,
      coachingError: null,
      updateText: "",
      isUpdateLoading: false,
      isUpdateDone: false,
      liveStats: null,
    });
  },

  appendUpdateText: (text) => {
    clearMinimizeTimer();
    set((state) => ({
      updateText: state.updateText + text,
      isUpdateLoading: true,
      isExpanded: true,
    }));
  },

  setUpdateDone: () => {
    startMinimizeTimer(set);
    set({ isUpdateDone: true, isUpdateLoading: false });
  },

  toggleExpanded: () => {
    clearMinimizeTimer();
    set((state) => ({ isExpanded: !state.isExpanded }));
  },

  setExpanded: (expanded) => {
    clearMinimizeTimer();
    set({ isExpanded: expanded });
  },

  setLiveStats: (stats) => set({ liveStats: stats }),
}));
