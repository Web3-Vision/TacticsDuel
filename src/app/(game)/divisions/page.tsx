import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, cn } from "@/lib/utils";

export default async function DivisionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get top players by ELO
  const { data: leaderboard } = await supabase
    .from("profiles")
    .select("id, username, club_name, division, elo_rating, wins, draws, losses")
    .order("elo_rating", { ascending: false })
    .limit(50);

  let myProfile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    myProfile = data;
  }

  return (
    <div className="p-4">
      <h1 className="font-mono text-lg uppercase tracking-wide mb-4">
        Divisions
      </h1>

      {/* Division info */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {DIVISIONS.map((d) => (
          <div
            key={d.id}
            className={cn(
              "shrink-0 px-3 py-2 border rounded-[4px] min-w-[80px]",
              myProfile?.division === d.id
                ? "border-accent bg-accent/10"
                : "border-border"
            )}
          >
            <p className="font-mono text-[10px] text-text-dim uppercase">
              Div {d.id}
            </p>
            <p className="font-mono text-xs text-text-mid">{d.name}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-surface border border-border rounded-md">
        <div className="px-3 py-2 border-b border-border flex items-center">
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-6">
            #
          </span>
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide flex-1">
            Club
          </span>
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-10 text-right">
            Div
          </span>
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-12 text-right">
            ELO
          </span>
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide w-16 text-right">
            W-D-L
          </span>
        </div>
        {leaderboard?.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "px-3 h-[40px] flex items-center border-b border-border last:border-b-0",
              p.id === user?.id && "bg-accent/5"
            )}
          >
            <span className="font-mono text-xs text-text-dim w-6 tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-text truncate">
                {p.club_name}
              </p>
              <p className="font-mono text-[10px] text-text-dim truncate">
                {p.username}
              </p>
            </div>
            <span className="font-mono text-xs text-text-dim w-10 text-right">
              {p.division}
            </span>
            <span className="font-mono text-xs text-accent w-12 text-right tabular-nums">
              {p.elo_rating}
            </span>
            <span className="font-mono text-[10px] text-text-dim w-16 text-right tabular-nums">
              {p.wins}-{p.draws}-{p.losses}
            </span>
          </div>
        ))}
        {(!leaderboard || leaderboard.length === 0) && (
          <p className="text-text-mid text-sm text-center py-6">
            No players yet.
          </p>
        )}
      </div>
    </div>
  );
}
