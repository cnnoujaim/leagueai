import { useGameStore } from "../stores/gameStore";
import type { PlayerStats } from "../stores/gameStore";

export function LiveStats() {
  const { liveStats } = useGameStore();

  if (!liveStats) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)] text-sm">
        <div className="text-2xl mb-2">&#128202;</div>
        <p>Waiting for game data...</p>
        <p className="text-xs mt-1">
          Stats will appear once you're in an active game.
        </p>
      </div>
    );
  }

  const { gameTime, myTeam, enemyTeam } = liveStats;
  const minutes = Math.floor(gameTime / 60);
  const seconds = String(Math.floor(gameTime % 60)).padStart(2, "0");

  const teamTotals = calcTeamTotals(myTeam);
  const enemyTotals = calcTeamTotals(enemyTeam);

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* Game clock */}
      <div className="text-center text-xs text-[var(--text-secondary)]">
        {minutes}:{seconds}
      </div>

      {/* Team totals comparison */}
      <div className="grid grid-cols-3 gap-1 text-center text-xs">
        <TeamTotal label="YOUR TEAM" totals={teamTotals} side="left" />
        <div className="flex flex-col justify-center gap-1 text-[var(--text-secondary)]">
          <span>KDA</span>
          <span>CS</span>
          <span>Gold</span>
        </div>
        <TeamTotal label="ENEMY" totals={enemyTotals} side="right" />
      </div>

      {/* Per-player scoreboard */}
      <div className="space-y-1">
        <div className="text-xs font-semibold bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
          YOUR TEAM
        </div>
        {myTeam.map((p) => (
          <PlayerRow key={p.summonerName} player={p} isAlly />
        ))}
      </div>

      <div className="border-t border-[var(--border)]" />

      <div className="space-y-1">
        <div className="text-xs font-semibold text-red-400">
          ENEMY TEAM
        </div>
        {enemyTeam.map((p) => (
          <PlayerRow key={p.summonerName} player={p} isAlly={false} />
        ))}
      </div>
    </div>
  );
}

function TeamTotal({
  label,
  totals,
  side,
}: {
  label: string;
  totals: { kills: number; deaths: number; assists: number; cs: number; gold: number };
  side: "left" | "right";
}) {
  const align = side === "left" ? "text-left" : "text-right";
  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <span className="font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="text-[var(--text-primary)]">
        {totals.kills}/{totals.deaths}/{totals.assists}
      </span>
      <span className="text-[var(--text-primary)]">{totals.cs}</span>
      <span className="text-yellow-400">{formatGold(totals.gold)}</span>
    </div>
  );
}

function PlayerRow({ player, isAlly }: { player: PlayerStats; isAlly: boolean }) {
  const kda = `${player.kills}/${player.deaths}/${player.assists}`;
  const nameColor = player.isDead
    ? "text-red-400/60"
    : "text-[var(--text-primary)]";

  return (
    <div className={`flex items-center gap-2 px-1 py-0.5 rounded text-xs ${player.isDead ? "opacity-60" : ""}`}>
      {/* Champion + level */}
      <div className="flex items-center gap-1 w-[100px] min-w-[100px]">
        <span className={`font-medium truncate ${nameColor}`}>
          {player.championName}
        </span>
        <span className="text-[var(--text-secondary)]">
          {player.level}
        </span>
      </div>

      {/* KDA */}
      <div className="w-[60px] text-center">
        <span className={kdaColor(player)}>{kda}</span>
      </div>

      {/* CS */}
      <div className="w-[30px] text-center text-[var(--text-secondary)]">
        {player.cs}
      </div>

      {/* Gold (only shown for self) */}
      <div className="w-[45px] text-right">
        {player.gold != null ? (
          <span className="text-yellow-400">{formatGold(player.gold)}</span>
        ) : (
          <span className="text-[var(--text-secondary)]">-</span>
        )}
      </div>

      {/* Items (compact) */}
      <div className="flex-1 text-right text-[var(--text-secondary)] truncate">
        {player.items.length > 0 ? `${player.items.length} items` : ""}
      </div>
    </div>
  );
}

function calcTeamTotals(team: PlayerStats[]) {
  return team.reduce(
    (acc, p) => ({
      kills: acc.kills + p.kills,
      deaths: acc.deaths + p.deaths,
      assists: acc.assists + p.assists,
      cs: acc.cs + p.cs,
      gold: acc.gold + (p.gold ?? 0),
    }),
    { kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0 }
  );
}

function formatGold(gold: number): string {
  if (gold >= 1000) return `${(gold / 1000).toFixed(1)}k`;
  return String(gold);
}

function kdaColor(player: PlayerStats): string {
  const ratio = (player.kills + player.assists) / Math.max(player.deaths, 1);
  if (ratio >= 5) return "text-yellow-400";
  if (ratio >= 3) return "text-green-400";
  if (ratio >= 1.5) return "text-[var(--text-primary)]";
  return "text-red-400";
}
