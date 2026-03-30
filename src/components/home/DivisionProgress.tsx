import { cn } from "@/lib/utils";
import type { Profile, Division } from "@/lib/types";

interface Last5Entry {
  result: string;
  score: string;
}

interface DivisionProgressProps {
  profile: {
    division_points: number;
    wins: number;
    draws: number;
    losses: number;
    elo_rating: number;
  };
  division: Division | null;
  last5: Last5Entry[];
}

export default function DivisionProgress({
  profile,
  division,
  last5,
}: DivisionProgressProps) {
  if (!division) return null;

  return (
    <div className="bg-surface border border-border rounded-md p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          {division.name}
        </span>
        <span className="font-mono text-xs text-text-mid tabular-nums">
          {profile.division_points}
          {division.pointsToPromote
            ? ` / ${division.pointsToPromote}`
            : ""}{" "}
          pts
        </span>
      </div>
      {division.pointsToPromote && (
        <div className="h-1.5 bg-border rounded-sm overflow-hidden">
          <div
            className="h-full bg-accent"
            style={{
              width: `${Math.min(100, Math.max(0, (profile.division_points / division.pointsToPromote) * 100))}%`,
            }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        {last5.length > 0 && (
          <div className="flex gap-1">
            {last5.map((entry, i) => (
              <div
                key={i}
                title={entry.score}
                className={cn(
                  "w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[8px] font-semibold cursor-default",
                  entry.result === "W" && "bg-win/20 text-win",
                  entry.result === "D" && "bg-draw/20 text-draw",
                  entry.result === "L" && "bg-loss/20 text-loss"
                )}
              >
                {entry.result}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <span className="font-mono text-xs text-text-mid tabular-nums">
          <span className="text-win">{profile.wins}W</span>{" "}
          <span className="text-draw">{profile.draws}D</span>{" "}
          <span className="text-loss">{profile.losses}L</span>
        </span>
        <span className="font-mono text-xs text-text-dim tabular-nums">
          ELO {profile.elo_rating}
        </span>
      </div>
    </div>
  );
}
