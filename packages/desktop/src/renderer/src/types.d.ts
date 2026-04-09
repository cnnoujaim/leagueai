export {};

declare global {
  interface Window {
    leagueAI: {
      onCoachingChunk: (callback: (text: string) => void) => void;
      onCoachingDone: (callback: () => void) => void;
      onCoachingCached: (callback: (text: string) => void) => void;
      onCoachingError: (callback: (error: string) => void) => void;
      onGameFlowChanged: (callback: (phase: string) => void) => void;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      showOverlay: () => void;
      hideOverlay: () => void;
      signInWithGoogle: () => Promise<{ user?: unknown; error?: string }>;
      signOut: () => Promise<void>;
      getUser: () => Promise<unknown>;
      onAuthChanged: (callback: (user: unknown) => void) => void;
    };
  }
}
