import { useGameState } from "./hooks/useGameState";
import { useAuth } from "./hooks/useAuth";
import { MatchupBriefing } from "./components/MatchupBriefing";
import { MinimalHUD } from "./components/MinimalHUD";
import { AuthPanel } from "./components/AuthPanel";

export default function App() {
  const { isExpanded, setExpanded } = useGameState();
  const { user } = useAuth();

  return (
    <div className="w-full h-full flex flex-col items-end">
      {isExpanded ? (
        <div
          className="overlay-panel w-[400px] max-h-[560px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--overlay-bg)] shadow-2xl"
          onMouseEnter={() => window.leagueAI?.setIgnoreMouseEvents(false)}
          onMouseLeave={() => window.leagueAI?.setIgnoreMouseEvents(true)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <div
              className="text-sm font-bold bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent"
            >
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
  );
}
