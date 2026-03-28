import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division)
    : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      {profile && division && (
        <div className="bg-surface border border-border rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
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
                  width: `${Math.min(100, (profile.division_points / division.pointsToPromote) * 100)}%`,
                }}
              />
            </div>
          )}
          <div className="flex gap-3 mt-2 font-mono text-xs text-text-mid tabular-nums">
            <span>
              <span className="text-win">{profile.wins}W</span>
            </span>
            <span>
              <span className="text-draw">{profile.draws}D</span>
            </span>
            <span>
              <span className="text-loss">{profile.losses}L</span>
            </span>
            <span className="ml-auto">ELO {profile.elo_rating}</span>
          </div>
        </div>
      )}

      <Link
        href="/play"
        className="block w-full h-12 leading-[48px] text-center bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100"
      >
        Play Ranked
      </Link>

      <Link
        href="/play"
        className="block w-full h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-sm uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
      >
        VS Friend
      </Link>

      <div className="bg-surface border border-border rounded-md p-3">
        <p className="font-mono text-xs text-text-dim uppercase tracking-wide mb-2">
          Recent Matches
        </p>
        <p className="text-text-mid text-sm">
          No matches yet. Play your first game.
        </p>
      </div>
    </div>
  );
}
