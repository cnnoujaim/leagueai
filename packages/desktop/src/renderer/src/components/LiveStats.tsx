import { useGameStore } from "../stores/gameStore";
import type { PlayerStats } from "../stores/gameStore";

export function LiveStats() {
  const { liveStats } = useGameStore();

  if (!liveStats) return null;

  const { gameTime, player, myTeam, enemyTeam } = liveStats;
  const minutes = Math.floor(gameTime / 60);
  const seconds = String(Math.floor(gameTime % 60)).padStart(2, "0");

  const teamGold = sumGold(myTeam);
  const enemyGold = sumGold(enemyTeam);
  const diff = teamGold - enemyGold;

  return (
    <div
      className="rounded-b-lg border border-t-0 border-[var(--border)] bg-[var(--overlay-bg)] shadow-2xl"
      onMouseEnter={() => window.leagueAI?.setIgnoreMouseEvents(false)}
      onMouseLeave={() => window.leagueAI?.setIgnoreMouseEvents(true)}
    >
      <div className="flex items-center text-xs">
        {/* Allied team */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          {myTeam.map((p) => (
            <ChampChip
              key={p.summonerName}
              player={p}
              isSelf={p.summonerName === player.summonerName}
              side="ally"
            />
          ))}
        </div>

        {/* Center scoreboard */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-x border-[var(--border)]">
          <span className="text-blue-400 font-semibold">{formatGold(teamGold)}</span>

          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] text-[var(--text-secondary)]">
              {minutes}:{seconds}
            </span>
            <span className={`text-[10px] font-bold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>
              {diff > 0 ? "+" : ""}{formatGold(diff)}
            </span>
          </div>

          <span className="text-red-400 font-semibold">{formatGold(enemyGold)}</span>
        </div>

        {/* Enemy team */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          {enemyTeam.map((p) => (
            <ChampChip
              key={p.summonerName}
              player={p}
              isSelf={false}
              side="enemy"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChampChip({
  player,
  isSelf,
  side,
}: {
  player: PlayerStats;
  isSelf: boolean;
  side: "ally" | "enemy";
}) {
  const borderColor = isSelf
    ? "border-[var(--accent)]"
    : side === "ally"
      ? "border-blue-500/40"
      : "border-red-500/40";

  const bgColor = player.isDead
    ? "bg-gray-800/60"
    : side === "ally"
      ? "bg-blue-950/40"
      : "bg-red-950/40";

  return (
    <div
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded border ${borderColor} ${bgColor} ${player.isDead ? "opacity-50" : ""}`}
      title={`${player.summonerName} — ${player.kills}/${player.deaths}/${player.assists} | ${player.cs} CS${player.gold != null ? ` | ${formatGold(player.gold)} gold` : ""}`}
    >
      <div className="flex items-baseline gap-0.5">
        <span className={`text-[11px] font-medium max-w-[60px] truncate ${kdaColor(player)}`}>
          {player.championName}
        </span>
        <span className="text-[9px] text-[var(--text-secondary)]">
          {player.level}
        </span>
      </div>

      {/* Gold */}
      <span className="text-[10px] text-yellow-400">
        {player.gold != null ? formatGold(player.gold) : "-"}
      </span>
    </div>
  );
}

function sumGold(team: PlayerStats[]): number {
  return team.reduce((sum, p) => sum + (p.gold ?? 0), 0);
}

function formatGold(gold: number): string {
  const abs = Math.abs(gold);
  if (abs >= 1000) return `${(gold / 1000).toFixed(1)}k`;
  return String(gold);
}

function kdaColor(player: PlayerStats): string {
  const ratio = (player.kills + player.assists) / Math.max(player.deaths, 1);
  if (ratio >= 5) return "text-green-400";
  if (ratio >= 3) return "text-yellow-400";
  return "text-red-400";
}
