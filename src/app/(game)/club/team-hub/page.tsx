import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFormation } from "@/lib/data/formations";
import { getPlayerById } from "@/lib/data/players";
import { formatPrice } from "@/lib/utils";

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
      <div className="p-4">
        <div className="bg-surface border border-border rounded-md p-4">
          <p className="font-mono text-xs text-text">Sign in to access Team Hub.</p>
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: squad }, { count: openListingCount }] = await Promise.all([
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

  return (
    <div className="p-4 flex flex-col gap-3 pb-20">
      <section className="bg-surface border border-border rounded-md p-4">
        <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Team Hub</p>
        <p className="font-mono text-sm text-text mt-1">Squad readiness and market control center.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Coins</p>
            <p className="font-mono text-xs text-gold tabular-nums mt-0.5">{formatPrice(profile?.coins ?? 0)}</p>
          </div>
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Transfers</p>
            <p className="font-mono text-xs text-text tabular-nums mt-0.5">{profile?.transfers_remaining ?? 0}</p>
          </div>
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Cycle Matches</p>
            <p className="font-mono text-xs text-text tabular-nums mt-0.5">{profile?.ranked_matches_in_cycle ?? 0}</p>
          </div>
          <div className="bg-bg border border-border rounded-[4px] px-2.5 py-2">
            <p className="font-mono text-[9px] text-text-dim uppercase">Open Listings</p>
            <p className="font-mono text-xs text-text tabular-nums mt-0.5">{openListingCount ?? 0}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/club/market"
            className="inline-flex h-8 px-3 items-center rounded-[4px] bg-accent text-black font-mono text-[10px] uppercase tracking-wide hover:bg-accent-dim transition-colors duration-100"
          >
            Browse Market
          </Link>
          <Link
            href="/club/squad"
            className="inline-flex h-8 px-3 items-center rounded-[4px] border border-border text-text-mid font-mono text-[10px] uppercase tracking-wide hover:border-border-light transition-colors duration-100"
          >
            Edit Squad
          </Link>
        </div>

        {profile?.squad_locked && (
          <p className="font-mono text-[10px] text-loss mt-2">
            Squad is locked for the current ranked cycle. You can still browse market listings.
          </p>
        )}
      </section>

      <section className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Starting XI</p>
          <p className="font-mono text-[10px] text-text-dim tabular-nums">{filledStarters}/11</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {formation.slots.map((slot, index) => {
            const player = starters[index];
            return (
              <div
                key={`${slot.label}-${index}`}
                className="h-10 px-2.5 rounded-[4px] border border-border flex items-center gap-2"
              >
                <span className="font-mono text-[10px] text-text-dim uppercase w-8">{slot.label}</span>
                {player ? (
                  <>
                    <span className="font-mono text-xs text-text flex-1 truncate">{player.name}</span>
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

      <section className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Bench Unit</p>
          <p className="font-mono text-[10px] text-text-dim tabular-nums">{filledBench}/10</p>
        </div>
        {filledBench === 0 ? (
          <p className="font-mono text-xs text-text-dim">No bench players assigned.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {bench.map((player, index) => {
              if (!player) return null;
              return (
                <div key={`${player.id}-${index}`} className="h-9 px-2.5 rounded-[4px] border border-border flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-dim uppercase w-6">{player.position}</span>
                  <span className="font-mono text-xs text-text flex-1 truncate">{player.name}</span>
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
