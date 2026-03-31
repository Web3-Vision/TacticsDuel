import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, getEloRank } from "@/lib/utils";
import { CheckCircle2, Circle, Swords, UserPlus, ShoppingCart } from "lucide-react";
import DivisionProgress from "@/components/home/DivisionProgress";
import RecentResults from "@/components/home/RecentResults";
import SquadPreview from "@/components/home/SquadPreview";
import NarrativeFeed from "@/components/narrative/NarrativeFeed";
import { buildNarrativeContent, buildNarrativeContentFromPersistence } from "@/lib/narrative/content-system";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let squadSaved = false;
  let tacticsSaved = false;
  let recentMatches: Array<{
    id: string;
    home_user_id: string;
    away_user_id: string | null;
    home_score: number;
    away_score: number;
    match_type: string;
    completed_at: string;
    home_elo_change: number | null;
    away_elo_change: number | null;
  }> = [];
  let clubNameByUserId: Record<string, string> = {};
  let inboxRows: Array<{ id: string; title: string; body: string; created_at: string }> = [];
  let newsRows: Array<{ id: string; title: string; summary: string; created_at: string }> = [];
  let recapRows: Array<{
    id: string;
    recap: {
      matchType?: string;
      scoreline?: { home?: number; away?: number };
      keyMoments?: Array<{ minute?: number; description?: string }>;
    } | null;
    created_at: string;
  }> = [];

  if (user) {
    const [
      { data: profileData },
      { data: squadData },
      { data: tacticsData },
      { data: matches },
      { data: persistedInbox },
      { data: persistedNews },
      { data: persistedRecap },
    ] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("squads").select("user_id").eq("user_id", user.id).single(),
        supabase.from("tactics").select("user_id").eq("user_id", user.id).single(),
        supabase
          .from("matches")
          .select("id, home_user_id, away_user_id, home_score, away_score, match_type, completed_at, home_elo_change, away_elo_change")
          .or(`home_user_id.eq.${user.id},away_user_id.eq.${user.id}`)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(8),
        supabase
          .from("inbox_messages")
          .select("id, title, body, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("news_feed_items")
          .select("id, title, summary, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("match_round_recaps")
          .select("id, recap, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    profile = profileData;
    squadSaved = !!squadData;
    tacticsSaved = !!tacticsData;
    recentMatches = (matches ?? []) as typeof recentMatches;
    inboxRows = (persistedInbox ?? []) as typeof inboxRows;
    newsRows = (persistedNews ?? []) as typeof newsRows;
    recapRows = (persistedRecap ?? []) as typeof recapRows;

    const participantIds = [...new Set(recentMatches.flatMap((m) => [m.home_user_id, m.away_user_id]).filter(Boolean))] as string[];
    if (participantIds.length > 0) {
      const { data: clubs } = await supabase
        .from("profiles")
        .select("id, club_name")
        .in("id", participantIds);
      clubNameByUserId = Object.fromEntries((clubs ?? []).map((club) => [club.id, club.club_name]));
    }
  }

  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division) ?? null
    : null;

  const last5 = recentMatches.map((m) => {
    const isHome = m.home_user_id === user?.id;
    const myScore = isHome ? m.home_score : m.away_score;
    const theirScore = isHome ? m.away_score : m.home_score;
    const result = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
    return { result, score: `${myScore}-${theirScore}` };
  });

  const totalMatches = profile
    ? profile.wins + profile.draws + profile.losses
    : 0;
  const winRate =
    totalMatches > 0 ? Math.round((profile!.wins / totalMatches) * 100) : 0;
  const eloRank = profile ? getEloRank(profile.elo_rating) : null;

  const rankedReady =
    !!profile && squadSaved && tacticsSaved && !!profile.squad_locked;

  const rankedActionHref =
    !profile || rankedReady
      ? "/play"
      : !squadSaved
        ? "/club/squad"
        : !tacticsSaved
          ? "/club/tactics"
          : "/club/squad";

  const rankedActionLabel =
    !profile || rankedReady
      ? "Queue Ranked Match"
      : !squadSaved
        ? "Save Your Squad"
        : !tacticsSaved
          ? "Save Your Tactics"
          : "Lock Squad For Ranked";

  const readinessItems = [
    { done: squadSaved, label: "Squad saved" },
    { done: tacticsSaved, label: "Tactics saved" },
    { done: !!profile?.squad_locked, label: "Squad lock active" },
  ];

  const narrative = user
    ? (inboxRows.length > 0 || newsRows.length > 0 || recapRows.length > 0
        ? buildNarrativeContentFromPersistence({
            inboxRows,
            newsRows,
            recapRows,
          })
        : buildNarrativeContent({
            userId: user.id,
            matches: recentMatches,
            clubNameByUserId,
          }))
    : { inbox: [], news: [], roundRecap: [] };

  return (
    <div className="flex flex-col gap-3 p-3 pb-20 md:p-4 md:pb-24">
      {profile && division && (
        <div className="panel-enter">
          <DivisionProgress profile={profile} division={division} last5={last5} />
        </div>
      )}

      {profile && (
        <section className="glass-panel panel-enter rounded-xl p-3">
          <p className="section-title">Club Pulse</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="ELO" value={String(profile.elo_rating)} highlight={eloRank?.color} subLabel={eloRank?.label} />
            <StatCard
              label="Record"
              value={`${profile.wins}W ${profile.draws}D ${profile.losses}L`}
              valueClass="text-xs"
            />
            <StatCard label="Win Rate" value={`${winRate}%`} />
            <StatCard label="Coins" value={String(profile.coins)} valueClass="text-gold" />
          </div>
        </section>
      )}

      <section className="glass-panel panel-enter rounded-xl p-3">
        <p className="section-title">Next Best Action</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link
            href={rankedActionHref}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-md bg-accent px-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-black transition-colors duration-150 hover:bg-accent-dim"
          >
            <Swords size={15} strokeWidth={1.9} />
            {rankedActionLabel}
          </Link>
          <Link
            href="/play"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 font-mono text-xs uppercase tracking-[0.14em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
          >
            <UserPlus size={15} strokeWidth={1.9} />
            Invite A Friend
          </Link>
          <Link
            href="/club/market"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 font-mono text-xs uppercase tracking-[0.14em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
          >
            <ShoppingCart size={15} strokeWidth={1.9} />
            Open Market
          </Link>
        </div>

        {profile && !rankedReady && (
          <div className="mt-3 rounded-md border border-border bg-bg/55 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
              Ranked readiness
            </p>
            <div className="mt-2 grid gap-1 sm:grid-cols-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 font-mono text-xs text-text-mid">
                  {item.done ? (
                    <CheckCircle2 size={13} className="text-accent" strokeWidth={1.8} />
                  ) : (
                    <Circle size={13} className="text-text-dim" strokeWidth={1.8} />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="panel-enter">
        <SquadPreview />
      </div>

      {user && (
        <section className="glass-panel panel-enter rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="section-title">Narrative Wire</p>
            <div className="flex items-center gap-2">
              <Link href="/inbox" className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                Inbox
              </Link>
              <Link href="/news" className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                News
              </Link>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <NarrativeFeed items={narrative.inbox} maxItems={2} compact emptyLabel="No inbox updates." />
            <NarrativeFeed items={narrative.news} maxItems={2} compact emptyLabel="No news updates." />
          </div>
          <div className="mt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">Round Recap</p>
            <div className="mt-1">
              <NarrativeFeed items={narrative.roundRecap} maxItems={1} compact emptyLabel="No recap available." />
            </div>
          </div>
        </section>
      )}

      {profile && (
        <section className="glass-panel panel-enter rounded-xl p-3">
          <p className="section-title">Season Snapshot</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <InlineStat label="Matches" value={String(totalMatches)} />
            <InlineStat label="Win Rate" value={`${winRate}%`} />
            <InlineStat label="Current Streak" value={String(profile.current_streak)} />
            <InlineStat label="Best Streak" value={String(profile.best_streak)} valueClass="text-gold" />
          </div>
        </section>
      )}

      {user && (
        <div className="panel-enter">
          <RecentResults matches={recentMatches} userId={user.id} />
        </div>
      )}

      <section className="glass-panel panel-enter rounded-xl p-3">
        <p className="section-title">Objectives</p>
        <div className="mt-2 flex flex-col gap-2 text-xs">
          <ObjectiveRow label="Play 3 ranked matches" progress="0/3" />
          <ObjectiveRow label="Win a match with 60%+ possession" progress="0/1" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  subLabel,
  valueClass,
}: {
  label: string;
  value: string;
  highlight?: string;
  subLabel?: string;
  valueClass?: string;
}) {
  return (
    <article className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">{label}</p>
      <p className={`mt-0.5 font-mono text-sm tabular-nums text-text ${valueClass ?? ""}`} style={highlight ? { color: highlight } : undefined}>
        {value}
      </p>
      {subLabel && (
        <p className="font-mono text-[9px] uppercase tracking-[0.1em]" style={highlight ? { color: highlight } : undefined}>
          {subLabel}
        </p>
      )}
    </article>
  );
}

function InlineStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-bg/65 px-2.5 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">{label}</span>
      <span className={`font-mono text-sm tabular-nums text-text ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

function ObjectiveRow({ label, progress }: { label: string; progress: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-bg/65 px-2.5 py-2">
      <span className="font-mono text-xs text-text-mid">{label}</span>
      <span className="font-mono text-[10px] tabular-nums text-text-dim">{progress}</span>
    </div>
  );
}
