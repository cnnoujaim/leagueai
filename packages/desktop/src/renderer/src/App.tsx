import { useGameState } from "./hooks/useGameState";
import { useAuth } from "./hooks/useAuth";
import { useGameStore } from "./stores/gameStore";
import { MatchupBriefing } from "./components/MatchupBriefing";
import { LiveStats } from "./components/LiveStats";
import { MinimalHUD } from "./components/MinimalHUD";
import { AuthPanel } from "./components/AuthPanel";

export default function App() {
  const { isExpanded, setExpanded } = useGameState();
  const { user } = useAuth();
  const { liveStats } = useGameStore();

  return (
    <div className="w-full h-full relative">
      {/* Stats bar — floats at top-center, independent of coaching panel */}
      {liveStats && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <LiveStats />
        </div>
      )}

      {/* Coaching panel — anchored to top-right */}
      <div className="absolute top-20 right-5">
        {isExpanded ? (
          <div
            className="overlay-panel w-[400px] max-h-[560px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--overlay-bg)] shadow-2xl"
            onMouseEnter={() => window.leagueAI?.setIgnoreMouseEvents(false)}
            onMouseLeave={() => window.leagueAI?.setIgnoreMouseEvents(true)}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <div className="text-sm font-bold bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
                LEAGUEAI
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer"
                title="Minimize"
              >
                &#8722;
              </button>
            </div>

            {/* Auth or Content */}
            {!user ? (
              <AuthPanel />
            ) : (
              <>
                <AuthPanel />
                <MatchupBriefing />
              </>
            )}
          </div>
        ) : (
          <MinimalHUD />
        )}
      </div>
    </div>
  );
}
