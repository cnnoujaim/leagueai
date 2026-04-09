import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    const api = window.leagueAI;
    if (!api) return;

    // Check for existing session on mount
    api.getUser().then((user: unknown) => {
      store.setUser(user as Parameters<typeof store.setUser>[0]);
    });

    // Listen for auth changes
    api.onAuthChanged((user: unknown) => {
      store.setUser(user as Parameters<typeof store.setUser>[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    store.setLoading(true);
    const result = await window.leagueAI?.signInWithGoogle();
    if (result?.error) {
      store.setError(result.error);
    }
  };

  const signOut = async () => {
    await window.leagueAI?.signOut();
    store.setUser(null);
  };

  return {
    ...store,
    signIn,
    signOut,
  };
}
