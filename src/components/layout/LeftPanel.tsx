import Link from "next/link";
import type { Profile } from "@/lib/types";
import { DIVISIONS } from "@/lib/utils";

interface LeftPanelProps {
  profile: Profile | null;
}

export default function LeftPanel({ profile }: LeftPanelProps) {
  if (!profile) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-text-dim uppercase tracking-wide">
          TacticsDuel
        </p>
        <Link
          href="/login"
          className="font-mono text-xs text-accent hover:underline"
        >
          Log in to play
        </Link>
      </div>
    );
  }

  const division = DIVISIONS.find((d) => d.id === profile.division);
  const totalMatches = profile.wins + profile.draws + profile.losses;
  const winRate =
    totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Club info */}
      <div>
        <p className="font-mono text-md font-semibold text-text">
          {profile.club_name}
        </p>
        <p className="font-mono text-xs text-text-dim">@{profile.username}</p>
      </div>

      {/* Division */}
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
            {division?.name ?? "Division"}
          </span>
          <span className="font-mono text-xs text-text-mid tabular-nums">
            {profile.division_points}
            {division?.pointsToPromote ? ` / ${division.pointsToPromote}` : ""} pts
          </span>
        </div>
        {division?.pointsToPromote && (
          <div className="h-1.5 bg-border rounded-sm overflow-hidden">
            <div
              className="h-full bg-accent"
              style={{
                width: `${Math.min(100, (profile.division_points / division.pointsToPromote) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-surface border border-border rounded-md p-3 flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="font-mono text-[10px] text-text-dim uppercase">ELO</span>
          <span className="font-mono text-xs text-text tabular-nums">{profile.elo_rating}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[10px] text-text-dim uppercase">Record</span>
          <span className="font-mono text-xs tabular-nums">
            <span className="text-win">{profile.wins}W</span>{" "}
            <span className="text-draw">{profile.draws}D</span>{" "}
            <span className="text-loss">{profile.losses}L</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[10px] text-text-dim uppercase">Win Rate</span>
          <span className="font-mono text-xs text-text tabular-nums">{winRate}%</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-col gap-1">
        <Link
          href="/squad"
          className="font-mono text-xs text-text-mid h-8 flex items-center hover:text-accent transition-colors duration-100"
        >
          Edit Squad
        </Link>
        <Link
          href="/squad/tactics"
          className="font-mono text-xs text-text-mid h-8 flex items-center hover:text-accent transition-colors duration-100"
        >
          Tactics
        </Link>
        <Link
          href="/play"
          className="font-mono text-xs text-text-mid h-8 flex items-center hover:text-accent transition-colors duration-100"
        >
          Play Match
        </Link>
      </div>
    </div>
  );
}
