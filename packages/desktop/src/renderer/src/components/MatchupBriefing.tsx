import { useGameStore } from "../stores/gameStore";

export function MatchupBriefing() {
  const {
    coachingText, isCoachingLoading, isCoachingDone, coachingError,
    updateText, isUpdateLoading,
  } = useGameStore();

  if (coachingError) {
    return (
      <div className="p-4 text-red-400 text-sm">
        <p className="font-semibold">Failed to load coaching</p>
        <p className="text-xs mt-1 text-red-300/70">{coachingError}</p>
      </div>
    );
  }

  if (!coachingText && !isCoachingLoading) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
        <div className="text-2xl mb-2">&#9876;</div>
        <p>Waiting for champion select...</p>
        <p className="text-xs mt-1">
          Lock in your champion and the coaching briefing will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1">
      {/* Mid-game update — shown first when available */}
      {(updateText || isUpdateLoading) && (
        <div className="mb-3 pb-3 border-b border-[var(--border)]">
          <div className="text-xs font-semibold mb-1 bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
            MID-GAME UPDATE
          </div>
          {isUpdateLoading && !updateText && (
            <div className="flex items-center gap-2 text-[var(--accent)] text-sm">
              <div className="animate-pulse">&#9679;</div>
              <span>Analyzing game state...</span>
            </div>
          )}
          <div
            className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap coaching-content"
            dangerouslySetInnerHTML={{ __html: formatCoachingText(updateText) }}
          />
          {isUpdateLoading && updateText && (
            <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse" />
          )}
        </div>
      )}

      {/* Original briefing */}
      {isCoachingLoading && !coachingText && (
        <div className="flex items-center gap-2 text-[var(--accent)] text-sm">
          <div className="animate-pulse">&#9679;</div>
          <span>Analyzing matchup...</span>
        </div>
      )}

      {coachingText && (updateText || isUpdateLoading) && (
        <div className="text-xs font-semibold mb-1 text-[var(--text-secondary)]">
          ORIGINAL BRIEFING
        </div>
      )}

      <div
        className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap coaching-content"
        dangerouslySetInnerHTML={{ __html: formatCoachingText(coachingText) }}
      />

      {isCoachingLoading && coachingText && (
        <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse" />
      )}

      {isCoachingDone && !updateText && !isUpdateLoading && (
        <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
          Briefing complete. Updates every 5 min.
        </div>
      )}
    </div>
  );
}

function formatCoachingText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, "<br/>");
}
