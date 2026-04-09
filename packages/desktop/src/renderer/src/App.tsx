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
  const { activeTab, setActiveTab, liveStats } = useGameStore();

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

              {/* Tabs */}
              <div className="flex border-b border-[var(--border)]">
                <TabButton
                  active={activeTab === "coaching"}
                  onClick={() => setActiveTab("coaching")}
                >
                  Coaching
                </TabButton>
                <TabButton
                  active={activeTab === "stats"}
                  onClick={() => setActiveTab("stats")}
                  badge={liveStats ? true : false}
                >
                  Live Stats
                </TabButton>
              </div>

              {activeTab === "coaching" ? <MatchupBriefing /> : <LiveStats />}
            </>
          )}
        </div>
      ) : (
        <MinimalHUD />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors
        ${active
          ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      {children}
      {badge && !active && (
        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
    </button>
  );
}
