import Link from "next/link";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  home_user_id: string;
  home_score: number;
  away_score: number;
  match_type: string;
  completed_at: string;
}

interface RecentResultsProps {
  matches: Match[];
  userId: string;
}

export default function RecentResults({ matches, userId }: RecentResultsProps) {
  return (
    <div className="bg-surface border border-border rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          Recent
        </span>
        {matches.length > 0 && (
          <Link href="/history" className="font-mono text-xs text-accent">
            View all
          </Link>
        )}
      </div>
      {matches.length === 0 ? (
        <p className="text-text-mid text-sm">
          No matches yet. Play your first game.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {matches.slice(0, 3).map((m) => {
            const isHome = m.home_user_id === userId;
            const myScore = isHome ? m.home_score : m.away_score;
            const theirScore = isHome ? m.away_score : m.home_score;
            const result =
              myScore > theirScore
                ? "W"
                : myScore < theirScore
                  ? "L"
                  : "D";

            return (
              <div key={m.id} className="flex items-center gap-2 h-8">
                <span
                  className={cn(
                    "font-mono text-xs font-medium w-3",
                    result === "W" && "text-win",
                    result === "D" && "text-draw",
                    result === "L" && "text-loss"
                  )}
                >
                  {result}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {myScore}-{theirScore}
                </span>
                <span className="flex-1 font-mono text-[10px] text-text-dim uppercase">
                  {m.match_type}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
