import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarClock, ChevronRight, Clock3, Gift, ShieldCheck, Swords, Trophy } from "lucide-react";
import { fetchLeagueLadder } from "@/lib/league/server";
import { buildLiveOpsEventCards, getCadenceSnapshot, sortMissionRows, type FeedContractRow, type LiveOpsEventCard, type MissionContractRow } from "@/lib/live-ops/contracts";
import { createClient } from "@/lib/supabase/server";
import { cn, DIVISIONS } from "@/lib/utils";

interface LeaderboardRow {
  id: string;
  username: string;
  club_name: string;
  division: number;
  division_points: number;
  elo_rating: number;
  wins: number;
  draws: number;
  losses: number;
}

type MissionRow = MissionContractRow;

interface RewardRow {
  id: string;
  season: number;
  highest_division: number;
  coins_earned: number;
  claimed: boolean;
  created_at: string;
}

type FeedRow = FeedContractRow;

function formatCountdown(target: Date, now: Date): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return "No expiry";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function buildPromotionHint(divisionId: number, points: number): { label: string; progressLabel: string; progressPct: number } {
  const current = DIVISIONS.find((div) => div.id === divisionId) ?? DIVISIONS.at(-1)!;
  const nextTier = DIVISIONS.find((div) => div.id === divisionId - 1) ?? null;

  if (!current.pointsToPromote) {
    return {
      label: "Top tier reached",
      progressLabel: "Ballon d'Or secured",
      progressPct: 100,
    };
  }

  const remaining = Math.max(0, current.pointsToPromote - points);
  const progressPct = Math.min(100, Math.round((points / current.pointsToPromote) * 100));

  return {
    label: nextTier
      ? `${remaining} pts to ${nextTier.name}`
      : `${remaining} pts to promotion`,
    progressLabel: `${points}/${current.pointsToPromote} pts`,
    progressPct,
  };
}

function formatRecord(row: LeaderboardRow): string {
  return `${row.wins}-${row.draws}-${row.losses}`;
}

export default async function DivisionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const [
    { data: profile },
    ladderResult,
    { data: missions },
    { data: rewards },
    { data: inbox },
    { data: news },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    fetchLeagueLadder(supabase, { division: null, limit: 80 }),
    supabase
      .from("missions")
      .select("id, mission_type, mission_key, description, target, progress, reward_coins, expires_at, claimed, is_featured, recommended_mode, priority_weight, created_at")
      .eq("user_id", user.id)
      .eq("claimed", false)
      .gte("expires_at", now.toISOString()),
    supabase
      .from("season_rewards")
      .select("id, season, highest_division, coins_earned, claimed, created_at")
      .eq("user_id", user.id)
      .eq("claimed", false)
      .order("season", { ascending: false })
      .limit(3),
    supabase
      .from("inbox_messages")
      .select("id, title, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("news_feed_items")
      .select("id, title, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (!profile) {
    redirect("/onboarding");
  }

  const typedLeaderboard = ladderResult.rows as LeaderboardRow[];
  const myRank = typedLeaderboard.findIndex((row) => row.id === profile.id) + 1;
  const { rows: divisionRows } = await fetchLeagueLadder(supabase, {
    division: profile.division,
    limit: 12,
  });

  const promotion = buildPromotionHint(profile.division, profile.division_points);
  const division = DIVISIONS.find((item) => item.id === profile.division) ?? DIVISIONS.at(-1)!;
  const nextDivision = DIVISIONS.find((item) => item.id === profile.division - 1) ?? null;

  const sortedMissions = sortMissionRows((missions ?? []) as MissionRow[]);
  const cadence = getCadenceSnapshot(now);
  const dailyResetAt = new Date(cadence.dailyResetAt);
  const weeklyResetAt = new Date(cadence.weeklyResetAt);
  const inboxRows = (inbox ?? []) as FeedRow[];
  const newsRows = (news ?? []) as FeedRow[];
  const pendingRewards = (rewards ?? []) as RewardRow[];
  const liveOpsEvents = buildLiveOpsEventCards({
    now,
    cadence,
    missions: sortedMissions,
    inbox: inboxRows,
    news: newsRows,
  });

  return (
    <div className="flex flex-col gap-3 p-3 pb-20 md:p-4 md:pb-24">
      <section className="glass-panel panel-enter overflow-hidden rounded-xl">
        <div className="relative border-b border-border/70 p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_10%_90%,rgba(52,211,153,0.18),transparent_45%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-title">League HQ</p>
              <h1 className="mt-1 font-mono text-lg uppercase tracking-[0.12em] text-text">Season {profile.division_season}</h1>
              <p className="mt-1 text-xs text-text-mid">
                Division {division.id} {division.name} · {promotion.label}
              </p>
            </div>
            <div className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Global Rank</p>
              <p className="font-mono text-sm tabular-nums text-text">#{myRank || "-"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Division Points" value={String(profile.division_points)} subValue={promotion.progressLabel} />
          <StatCard label="Season Record" value={`${profile.division_wins}-${profile.division_draws}-${profile.division_losses}`} subValue={`${profile.division_matches_played} played`} />
          <StatCard label="Cycle Matches" value={String(profile.ranked_matches_in_cycle)} subValue={`Cycle #${profile.cycle_id}`} />
          <StatCard label="Promotion Reward" value={`${nextDivision?.rewardCoins ?? division.rewardCoins}`} subValue="Coins on promotion" accent />
        </div>

        <div className="px-3 pb-3">
          <p className="section-title">Promotion Track</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-gold"
              style={{ width: `${promotion.progressPct}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <div className="glass-panel panel-enter rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="section-title">Division Ladder</p>
            <Link href="/club/leaderboard" className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
              Full Board
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-md border border-border/80 bg-bg/55">
            <div className="grid grid-cols-[32px_1fr_58px_60px] border-b border-border/70 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
              <span>#</span>
              <span>Club</span>
              <span className="text-right">PTS</span>
              <span className="text-right">Record</span>
            </div>
            {divisionRows.length === 0 ? (
              <p className="px-3 py-4 font-mono text-xs text-text-dim">No division entries yet.</p>
            ) : (
              divisionRows.map((row, index) => (
                <div
                  key={row.id}
                  className={cn(
                    "grid grid-cols-[32px_1fr_58px_60px] items-center border-b border-border/50 px-2 py-2 last:border-b-0",
                    row.id === profile.id && "bg-accent/10",
                  )}
                >
                  <span className="font-mono text-xs tabular-nums text-text-dim">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-text">{row.club_name}</p>
                    <p className="truncate font-mono text-[10px] text-text-dim">@{row.username}</p>
                  </div>
                  <span className="text-right font-mono text-xs tabular-nums text-accent">{row.division_points}</span>
                  <span className="text-right font-mono text-[10px] tabular-nums text-text-dim">{formatRecord(row)}</span>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ActionLink href="/play" icon={Swords} label="Queue Ranked" detail="Jump into your next ladder fixture." />
            <ActionLink href="/club/team-hub" icon={ShieldCheck} label="Squad Lock" detail="Finalize roster and cycle lock state." />
          </div>
        </div>

        <div className="glass-panel panel-enter rounded-xl p-3">
          <p className="section-title">Cadence Window</p>
          <div className="mt-2 space-y-2">
            <CadenceRow
              icon={Clock3}
              label="Daily Mission Reset"
              countdown={formatCountdown(dailyResetAt, now)}
              absoluteLabel={new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              }).format(dailyResetAt)}
            />
            <CadenceRow
              icon={CalendarClock}
              label="Weekly Rotation"
              countdown={formatCountdown(weeklyResetAt, now)}
              absoluteLabel={new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
              }).format(weeklyResetAt)}
            />
          </div>

          <div className="mt-3 rounded-md border border-border/80 bg-bg/55 p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">Current Stakes</p>
            <p className="mt-1 font-mono text-xs text-text-mid">
              {nextDivision
                ? `Promotion to Div ${nextDivision.id} unlocks ${nextDivision.rewardCoins} coins.`
                : "Top division active. Defend your position for season rewards."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="glass-panel panel-enter rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="section-title">Live Ops Missions</p>
            <Link href="/missions" className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
              Open Missions
            </Link>
          </div>

          {sortedMissions.length === 0 ? (
            <p className="mt-3 rounded-md border border-border/70 bg-bg/55 p-3 font-mono text-xs text-text-dim">
              No active missions. New objectives will rotate in at the next cadence reset.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {sortedMissions.slice(0, 4).map((mission) => {
                const progressRatio = mission.target <= 0 ? 0 : Math.min(1, mission.progress / mission.target);
                const completed = mission.progress >= mission.target;

                return (
                  <div key={mission.id} className="rounded-md border border-border/80 bg-bg/55 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs text-text">{mission.description}</p>
                      <span className="shrink-0 font-mono text-[10px] text-gold">+{mission.reward_coins}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/90">
                      <div
                        className={cn("h-full", completed ? "bg-accent" : "bg-accent/60")}
                        style={{ width: `${Math.round(progressRatio * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-text-dim">
                      <span>{mission.progress}/{mission.target}</span>
                      <span>{mission.mission_type.toUpperCase()} · {formatAbsoluteTime(mission.expires_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel panel-enter rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="section-title">Rewards Visibility</p>
            <Gift size={14} className="text-gold" />
          </div>

          <div className="mt-2 space-y-2">
            <RewardLine
              label="Promotion bonus"
              value={`${nextDivision?.rewardCoins ?? division.rewardCoins} coins`}
              note={nextDivision ? `On promotion to Div ${nextDivision.id}` : "Top tier defense payout"}
            />
            <RewardLine
              label="Current division reward"
              value={`${division.rewardCoins} coins`}
              note={`Division ${division.id} base payout`}
            />
            <RewardLine
              label="Unclaimed season rewards"
              value={pendingRewards.length > 0 ? `${pendingRewards.length} pending` : "None"}
              note={pendingRewards.length > 0
                ? pendingRewards.map((reward) => `S${reward.season}: +${reward.coins_earned}`).join(" · ")
                : "No historical rewards waiting"}
            />
          </div>

          <div className="mt-3 rounded-md border border-border/70 bg-bg/55 p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">Event Entry Points</p>
            <div className="mt-2 grid gap-1.5">
              <MiniLink href="/play" label="Match Center" />
              <MiniLink href="/missions" label="Missions Board" />
              <MiniLink href="/news" label="News Wire" />
              <MiniLink href="/inbox" label="Inbox Alerts" />
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel panel-enter rounded-xl p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="section-title">Live Event Wire</p>
          <Bell size={14} className="text-accent" />
        </div>

        {liveOpsEvents.length === 0 ? (
          <p className="mt-2 rounded-md border border-border/70 bg-bg/55 p-3 font-mono text-xs text-text-dim">
            No live ops events yet.
          </p>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {liveOpsEvents.slice(0, 4).map((event) => (
              <LiveOpsCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-bg/55 p-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.11em] text-text-dim">{label}</p>
      <p className={cn("mt-1 font-mono text-sm tabular-nums text-text", accent && "text-gold")}>{value}</p>
      <p className="mt-1 font-mono text-[10px] text-text-dim">{subValue}</p>
    </div>
  );
}

function CadenceRow({
  icon: Icon,
  label,
  countdown,
  absoluteLabel,
}: {
  icon: typeof Clock3;
  label: string;
  countdown: string;
  absoluteLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-bg/55 p-2.5">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-accent" />
        <div>
          <p className="font-mono text-xs text-text">{label}</p>
          <p className="font-mono text-[10px] text-text-dim">{absoluteLabel}</p>
        </div>
      </div>
      <span className="font-mono text-xs tabular-nums text-gold">{countdown}</span>
    </div>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  detail,
}: {
  href: string;
  icon: typeof Trophy;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[52px] items-center justify-between gap-2 rounded-md border border-border/80 bg-bg/55 px-3 py-2 transition-colors duration-150 hover:border-border-light"
    >
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-accent" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-text">{label}</p>
          <p className="font-mono text-[10px] text-text-dim">{detail}</p>
        </div>
      </div>
      <ChevronRight size={14} className="text-text-dim transition-colors group-hover:text-accent" />
    </Link>
  );
}

function RewardLine({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-bg/55 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">{label}</p>
        <p className="font-mono text-xs text-gold">{value}</p>
      </div>
      <p className="mt-1 font-mono text-[10px] text-text-mid">{note}</p>
    </div>
  );
}

function MiniLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[34px] items-center justify-between rounded-md border border-border/70 px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
    >
      <span>{label}</span>
      <ChevronRight size={12} />
    </Link>
  );
}

function FeedCard({
  title,
  href,
  items,
  emptyLabel,
}: {
  title: string;
  href: string;
  items: Array<{ id: string; title: string; summary: string }>;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-bg/55 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">{title}</p>
        <Link href={href} className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
          Open
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 font-mono text-xs text-text-dim">{emptyLabel}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-sm border border-border/60 bg-surface/45 p-2">
              <p className="line-clamp-1 font-mono text-xs text-text">{item.title}</p>
              <p className="mt-1 line-clamp-2 font-mono text-[10px] text-text-dim">{item.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveOpsCard({ event }: { event: LiveOpsEventCard }) {
  return (
    <Link
      href={event.entryHref}
      className="rounded-md border border-border/80 bg-bg/55 p-3 transition-colors duration-150 hover:border-border-light"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{event.category.replace("_", " ")}</p>
          <p className="mt-1 font-mono text-xs text-text">{event.title}</p>
        </div>
        <span className="font-mono text-[10px] text-gold">P{event.priority}</span>
      </div>
      <p className="mt-2 font-mono text-[10px] text-text-mid">{event.summary}</p>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-text-dim">
        <span>{formatAbsoluteTime(event.endsAt)}</span>
        <ChevronRight size={12} />
      </div>
    </Link>
  );
}
