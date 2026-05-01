import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFormation } from "@/lib/data/formations";
import { getPlayerById } from "@/lib/data/players";
import { countSavedStarters } from "@/lib/squad/persisted-squad";
import { formatPrice } from "@/lib/utils";
import { Lock, Unlock, ArrowRight } from "lucide-react";
import LockSquadPanel from "./lock-squad-panel";

interface SquadRow {
  formation: string;
  player_ids: Array<string | null>;
  bench_ids: Array<string | null>;
  total_cost: number | null;
}

export default async function TeamHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-3 md:p-4">
        <div className="glass-panel rounded-xl p-4">
          <p className="font-mono text-xs text-text">Sign in to access Team Hub.</p>
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: squad }, { data: tactics }, { count: openListingCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, coins, transfers_remaining, ranked_matches_in_cycle, squad_locked")
      .eq("id", user.id)
      .single(),
    supabase
      .from("squads")
      .select("formation, player_ids, bench_ids, total_cost")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("tactics")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("transfer_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", user.id)
      .eq("status", "open"),
  ]);

  const resolvedSquad: SquadRow = {
    formation: squad?.formation ?? "4-3-3",
    player_ids: (squad?.player_ids as Array<string | null> | null) ?? Array(11).fill(null),
    bench_ids: (squad?.bench_ids as Array<string | null> | null) ?? Array(10).fill(null),
    total_cost: squad?.total_cost ?? 0,
  };

  const formation = getFormation(resolvedSquad.formation);
  const starters = resolvedSquad.player_ids.map((playerId) => (playerId ? getPlayerById(playerId) : null));
  const bench = resolvedSquad.bench_ids.map((playerId) => (playerId ? getPlayerById(playerId) : null));
  const filledStarters = starters.filter(Boolean).length;
  const filledBench = bench.filter(Boolean).length;
  const savedStarterCount = countSavedStarters(squad);
  const hasTactics = Boolean(tactics?.user_id);

  return (
    <div className="flex flex-col gap-3 p-3 pb-20 md:p-4 md:pb-24">
      <section className="glass-panel panel-enter rounded-xl p-4">
        <p className="section-title">Team Hub</p>
        <h1 className="mt-1 font-mono text-lg uppercase tracking-[0.12em] text-text">
          Squad Readiness Board
        </h1>
        <p className="mt-1 text-xs text-text-mid">
          Manage availability, market exposure, and ranked lock status from one screen.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricTile label="Coins" value={formatPrice(profile?.coins ?? 0)} valueClass="text-gold" />
          <MetricTile label="Transfers" value={String(profile?.transfers_remaining ?? 0)} />
          <MetricTile label="Cycle Matches" value={String(profile?.ranked_matches_in_cycle ?? 0)} />
          <MetricTile label="Open Listings" value={String(openListingCount ?? 0)} />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/club/market"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition-colors duration-150 hover:bg-accent-dim"
          >
            Browse Market <ArrowRight size={13} strokeWidth={1.8} />
          </Link>
          <Link
            href="/club/squad"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-surface px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
          >
            Edit Squad
          </Link>
        </div>

        <div className="mt-3 rounded-md border border-border bg-bg/65 px-3 py-2">
          <p className="flex items-center gap-1.5 font-mono text-xs text-text-mid">
            {profile?.squad_locked ? (
              <Lock size={13} className="text-accent" strokeWidth={1.8} />
            ) : (
              <Unlock size={13} className="text-gold" strokeWidth={1.8} />
            )}
            {profile?.squad_locked
              ? "Squad is locked for ranked cycle. Market browsing remains available."
              : "Squad is unlocked. You can keep editing before entering ranked."}
          </p>
        </div>

        <LockSquadPanel
          squadLocked={Boolean(profile?.squad_locked)}
          savedStarterCount={savedStarterCount}
          hasTactics={hasTactics}
          rankedMatchesInCycle={profile?.ranked_matches_in_cycle ?? 0}
        />
      </section>

      <section className="glass-panel panel-enter rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="section-title">Starting XI</p>
          <p className="font-mono text-[10px] text-text-dim tabular-nums">{filledStarters}/11</p>
        </div>

        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {formation.slots.map((slot, index) => {
            const player = starters[index];
            return (
              <div
                key={slot.label + "-" + String(index)}
                className="flex h-10 items-center gap-2 rounded-md border border-border bg-bg/65 px-2.5 transition-colors duration-150 hover:border-border-light"
              >
                <span className="w-8 font-mono text-[10px] uppercase text-text-dim">{slot.label}</span>
                {player ? (
                  <>
                    <span className="flex-1 truncate font-mono text-xs text-text">{player.name}</span>
                    <span className="font-mono text-[10px] text-accent tabular-nums">{player.overall}</span>
                  </>
                ) : (
                  <span className="font-mono text-[10px] text-text-dim">Empty slot</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel panel-enter rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="section-title">Bench Unit</p>
          <p className="font-mono text-[10px] text-text-dim tabular-nums">{filledBench}/10</p>
        </div>

        {filledBench === 0 ? (
          <p className="font-mono text-xs text-text-dim">No bench players assigned yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {bench.map((player, index) => {
              if (!player) return null;
              return (
                <div
                  key={player.id + "-" + String(index)}
                  className="flex h-9 items-center gap-2 rounded-md border border-border bg-bg/65 px-2.5 transition-colors duration-150 hover:border-border-light"
                >
                  <span className="w-6 font-mono text-[10px] uppercase text-text-dim">{player.position}</span>
                  <span className="flex-1 truncate font-mono text-xs text-text">{player.name}</span>
                  <span className="font-mono text-[10px] text-accent tabular-nums">{player.overall}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-bg/65 px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">{label}</p>
      <p className={`mt-0.5 font-mono text-sm tabular-nums text-text ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
