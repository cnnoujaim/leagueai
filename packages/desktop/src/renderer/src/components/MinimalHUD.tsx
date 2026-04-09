import { useGameStore } from "../stores/gameStore";

export function MinimalHUD() {
  const { toggleExpanded, isCoachingDone, isCoachingLoading } = useGameStore();

  const hasContent = isCoachingDone || isCoachingLoading;

  return (
    <button
      onClick={toggleExpanded}
      onMouseEnter={() => window.leagueAI?.setIgnoreMouseEvents(false)}
      onMouseLeave={() => window.leagueAI?.setIgnoreMouseEvents(true)}
      className={`
        w-10 h-10 rounded-full flex items-center justify-center
        cursor-pointer transition-all duration-200 hover:scale-110
        ${hasContent
          ? "bg-gradient-to-br from-pink-500/30 to-yellow-500/30 border border-pink-400/40"
          : "bg-[var(--overlay-bg)] border border-[var(--border)] hover:border-pink-400/40"
        }
      `}
      title="Toggle LeagueAI briefing"
    >
      <span className="text-sm font-bold bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
        LA
      </span>
    </button>
  );
}
