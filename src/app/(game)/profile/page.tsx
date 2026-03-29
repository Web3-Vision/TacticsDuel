import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/utils";
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

  const division = DIVISIONS.find((d) => d.id === profile.division);
  const totalMatches = profile.wins + profile.draws + profile.losses;
  const winRate =
    totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <h1 className="font-mono text-xl font-semibold">{profile.club_name}</h1>
        <p className="font-mono text-xs text-text-dim mt-0.5">
          @{profile.username}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Division" value={division?.name ?? "--"} />
        <StatCard label="ELO Rating" value={String(profile.elo_rating)} />
        <StatCard label="Matches" value={String(totalMatches)} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
        <StatCard label="Record" value={`${profile.wins}W ${profile.draws}D ${profile.losses}L`} />
        <StatCard label="Best Streak" value={`${profile.best_streak}W`} />
        <StatCard label="Coins" value={String(profile.coins)} />
        <StatCard
          label="Member Since"
          value={new Date(profile.created_at).toLocaleDateString()}
        />
      </div>

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
