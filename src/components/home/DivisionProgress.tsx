import { cn } from "@/lib/utils";
import type { Profile, Division } from "@/lib/types";

interface DivisionProgressProps {
  profile: {
    division_points: number;
    wins: number;
    draws: number;
    losses: number;
    elo_rating: number;
  };
  division: Division | null;
  last5: string[];
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
            {last5.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "w-4 h-4 rounded-sm flex items-center justify-center font-mono text-[8px] font-semibold",
                  r === "W" && "bg-win/20 text-win",
                  r === "D" && "bg-draw/20 text-draw",
                  r === "L" && "bg-loss/20 text-loss"
                )}
              >
                {r}
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
