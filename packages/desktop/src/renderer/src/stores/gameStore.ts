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
  activeTab: "coaching" | "stats";

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
  setActiveTab: (tab: "coaching" | "stats") => void;
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
  activeTab: "coaching",

  setPhase: (phase) => set({ phase }),

  appendCoachingText: (text) =>
    set((state) => ({
      coachingText: state.coachingText + text,
      isCoachingLoading: true,
      isExpanded: true,
    })),

  setCoachingDone: () =>
    set({ isCoachingDone: true, isCoachingLoading: false }),

  setCoachingError: (error) =>
    set({ coachingError: error, isCoachingLoading: false }),

  setFullCoachingText: (text) =>
    set({
      coachingText: text,
      isCoachingDone: true,
      isCoachingLoading: false,
      isExpanded: true,
    }),

  resetCoaching: () =>
    set({
      coachingText: "",
      isCoachingDone: false,
      isCoachingLoading: false,
      coachingError: null,
      updateText: "",
      isUpdateLoading: false,
      isUpdateDone: false,
      liveStats: null,
    }),

  appendUpdateText: (text) =>
    set((state) => ({
      updateText: state.updateText + text,
      isUpdateLoading: true,
      isExpanded: true,
    })),

  setUpdateDone: () =>
    set({ isUpdateDone: true, isUpdateLoading: false }),

  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),

  setExpanded: (expanded) => set({ isExpanded: expanded }),

  setLiveStats: (stats) => set({ liveStats: stats }),

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
