import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/utils";
import TacticalIdentityBadge, { inferArchetype } from "@/components/share/TacticalIdentity";
import SignOutButton from "./SignOutButton";
import ManagerProfilePanel from "./ManagerProfilePanel";
import {
  ACCOUNT_STATUSES,
  MANAGER_ARCHETYPES,
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  BEARD_STYLES,
} from "@/lib/profile-options";

function pickOption<T extends readonly string[]>(
  options: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  if (typeof value === "string" && options.includes(value as T[number])) {
    return value as T[number];
  }
  return fallback;
}

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
    .select("home_user_id, away_user_id, home_score, away_score")
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

  const formSummary =
    form.length > 0 ? form.join(" • ") : "No ranked form yet";

  const accountStatus = pickOption(ACCOUNT_STATUSES, profile.account_status, ACCOUNT_STATUSES[0]);
  const managerArchetype = pickOption(
    MANAGER_ARCHETYPES,
    profile.manager_avatar_archetype,
    MANAGER_ARCHETYPES[0]
  );
  const hairStyle = pickOption(HAIR_STYLES, profile.manager_hair_style, HAIR_STYLES[0]);
  const hairColor = pickOption(HAIR_COLORS, profile.manager_hair_color, HAIR_COLORS[0]);
  const skinTone = pickOption(SKIN_TONES, profile.manager_skin_tone, SKIN_TONES[2]);
  const beardStyle = pickOption(BEARD_STYLES, profile.manager_beard_style, BEARD_STYLES[0]);

  return (
    <div className="p-4 flex flex-col gap-4 pb-safe">
      <div className="relative overflow-hidden rounded-2xl border border-border-light/70 bg-gradient-to-br from-surface-alt/95 via-surface/95 to-bg p-4 shadow-[0_20px_40px_rgba(1,4,9,0.45)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-home/20 blur-2xl" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            Club Profile
          </p>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight text-text">
            {profile.club_name}
          </h1>
          <p className="mt-1 font-mono text-xs text-text-mid">@{profile.username}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <HeroMetric label="Division" value={division?.name ?? "--"} />
            <HeroMetric label="ELO" value={String(profile.elo_rating)} accent="accent" />
            <HeroMetric label="Win Rate" value={`${winRate}%`} accent="gold" />
          </div>
        </div>
      </div>

      {/* Tactical identity */}
      {archetype && <TacticalIdentityBadge archetype={archetype} />}

      <ManagerProfilePanel
        managerName={profile.manager_name ?? profile.username}
        age={profile.age ?? null}
        favoriteTeam={profile.favorite_team ?? null}
        managerArchetype={managerArchetype}
        hairStyle={hairStyle}
        hairColor={hairColor}
        skinTone={skinTone}
        beardStyle={beardStyle}
        accountStatus={accountStatus}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
        <div className="rounded-xl border border-border-light/70 bg-gradient-to-br from-surface-alt/75 to-surface/80 p-3 shadow-[0_12px_24px_rgba(1,4,9,0.28)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
              Recent Form
            </p>
            <p className="font-mono text-[10px] text-text-mid">{formSummary}</p>
          </div>
          <div className="flex gap-1.5">
            {form.map((r, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-md border flex items-center justify-center font-mono text-[10px] font-bold ${
                  r === "W"
                    ? "border-win/40 bg-win/20 text-win"
                    : r === "L"
                      ? "border-loss/40 bg-loss/20 text-loss"
                      : "border-draw/40 bg-draw/20 text-draw"
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
    <div className="rounded-xl border border-border-light/65 bg-gradient-to-br from-surface-alt/70 to-surface/85 p-3 shadow-[0_10px_22px_rgba(1,4,9,0.25)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
        {label}
      </p>
      <p className="mt-1 font-mono text-base text-text tabular-nums">{value}</p>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "accent" | "gold";
}) {
  const accentClass =
    accent === "accent"
      ? "text-accent border-accent/35 bg-accent/10"
      : accent === "gold"
        ? "text-gold border-gold/30 bg-gold/10"
        : "text-text border-border-light/70 bg-bg/35";

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${accentClass}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
