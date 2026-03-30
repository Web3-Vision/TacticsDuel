import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/utils";
import TacticalIdentityBadge, { inferArchetype } from "@/components/share/TacticalIdentity";
import SignOutButton from "./SignOutButton";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4">
        <p className="text-text-mid text-sm">Log in to view profile.</p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="p-4">
        <p className="text-text-mid text-sm">Profile not found.</p>
      </div>
    );
  }

  // Get tactics for archetype
  const { data: tactics } = await supabase
    .from("tactics")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const division = DIVISIONS.find((d) => d.id === profile.division);
  const totalMatches = profile.wins + profile.draws + profile.losses;
  const winRate =
    totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  // Get recent form
  const { data: recentMatches } = await supabase
    .from("matches")
    .select("home_user_id, home_score, away_score")
    .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
    .eq("status", "completed")
    .eq("match_type", "ranked")
    .order("completed_at", { ascending: false })
    .limit(5);

  const form = (recentMatches ?? []).map((m) => {
    const isHome = m.home_user_id === user.id;
    const myScore = isHome ? m.home_score : m.away_score;
    const theirScore = isHome ? m.away_score : m.home_score;
    if (myScore > theirScore) return "W";
    if (myScore < theirScore) return "L";
    return "D";
  });

  const archetype = tactics
    ? inferArchetype({
        mentality: tactics.mentality,
        tempo: tactics.tempo,
        pressing: tactics.pressing,
        width: tactics.width,
      })
    : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <h1 className="font-mono text-xl font-semibold">{profile.club_name}</h1>
        <p className="font-mono text-xs text-text-dim mt-0.5">
          @{profile.username}
        </p>
      </div>

      {/* Tactical identity */}
      {archetype && <TacticalIdentityBadge archetype={archetype} />}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Division" value={division?.name ?? "--"} />
        <StatCard label="ELO Rating" value={String(profile.elo_rating)} />
        <StatCard label="Matches" value={String(totalMatches)} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
        <StatCard label="Record" value={`${profile.wins}W ${profile.draws}D ${profile.losses}L`} />
        <StatCard label="Best Streak" value={`${profile.best_streak}W`} />
        <StatCard label="Coins" value={String(profile.coins)} />
        <StatCard label="Season" value={String(profile.division_season ?? 1)} />
      </div>

      {/* Form */}
      {form.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-3">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide mb-1.5">Recent Form</p>
          <div className="flex gap-1.5">
            {form.map((r, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-sm flex items-center justify-center font-mono text-[10px] font-bold ${
                  r === "W" ? "bg-win/20 text-win" : r === "L" ? "bg-loss/20 text-loss" : "bg-draw/20 text-draw"
                }`}
              >
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      <SignOutButton />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-md p-3">
      <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide">
        {label}
      </p>
      <p className="font-mono text-md text-text mt-0.5">{value}</p>
    </div>
  );
}
