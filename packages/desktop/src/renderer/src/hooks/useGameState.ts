import { useEffect } from "react";
import { useGameStore } from "../stores/gameStore";

export function useGameState() {
  const store = useGameStore();

  useEffect(() => {
    const api = window.leagueAI;
    if (!api) return;

    api.onGameFlowChanged((phase) => {
      store.setPhase(phase);

      if (phase === "ChampSelect") {
        store.resetCoaching();
      }
    });

    api.onCoachingChunk((text) => {
      store.appendCoachingText(text);
    });

    api.onCoachingDone(() => {
      store.setCoachingDone();
    });

    api.onCoachingCached((text) => {
      store.setFullCoachingText(text);
    });

    api.onCoachingError((error) => {
      store.setCoachingError(error);
    });

    api.onCoachingUpdateChunk((text) => {
      store.appendUpdateText(text);
    });

    api.onCoachingUpdateDone(() => {
      store.setUpdateDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
