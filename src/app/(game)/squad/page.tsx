"use client";

import { useState, useEffect } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";
import { getFormation } from "@/lib/data/formations";
import { FORMATIONS } from "@/lib/data/formations";
import { cn, SALARY_CAP, formatPrice } from "@/lib/utils";
import PitchView from "@/components/pitch/PitchView";
import PositionGuide from "@/components/squad/PositionGuide";
import BudgetBar from "@/components/squad/BudgetBar";
import PlayerMarket from "@/components/squad/PlayerMarket";
import PlayerDetail from "@/components/squad/PlayerDetail";
import CycleStatus from "@/components/squad/CycleStatus";
import { createClient } from "@/lib/supabase/client";
import type { Player, Position, Profile } from "@/lib/types";
import { Save, Check } from "lucide-react";

// Lazy import players to avoid blocking initial render
let PLAYERS: Player[] = [];

export default function SquadPage() {
  const {
    formationId,
    setFormation,
    slots,
    activeSlotIndex,
    setActiveSlot,
    addPlayer,
    removePlayer,
    clearSquad,
    filledCount,
    totalSpent,
    budgetRemaining,
    positionForSlot,
    isPlayerInSquad,
    canAfford,
    loadSquad,
  } = useSquadStore();

  const [players, setPlayers] = useState<Player[]>([]);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "error">("");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load players and saved squad from Supabase
  useEffect(() => {
    async function init() {
      const mod = await import("@/lib/data/players");
      setPlayers(mod.PLAYERS);
      PLAYERS = mod.PLAYERS;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      // Load profile for cycle status
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profileData) setProfile(profileData as Profile);

      // Load saved squad
      const { data: squadData } = await supabase
        .from("squads")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_starter", true)
        .order("position_slot", { ascending: true });

      if (squadData && squadData.length > 0) {
        // Load saved tactics for formation
        const { data: tacticsData } = await supabase
          .from("tactics")
          .select("formation")
          .eq("user_id", user.id)
          .single();

        const savedFormation = tacticsData?.formation || "4-3-3";
        const savedSlots: (Player | null)[] = Array(11).fill(null);

        for (const row of squadData) {
          const player = mod.PLAYERS.find((p: Player) => p.id === row.player_id);
          if (player && row.position_slot >= 0 && row.position_slot < 11) {
            savedSlots[row.position_slot] = player;
          }
        }

        loadSquad(savedFormation, savedSlots);
      }

      setLoaded(true);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formation = getFormation(formationId);
  const squadLocked = profile?.squad_locked ?? false;

  // Filter position based on active slot
  const filterPos =
    activeSlotIndex !== null
      ? formation.slots[activeSlotIndex]?.position ?? null
      : null;

  function handleSelectPlayer(player: Player) {
    setDetailPlayer(player);
    setShowDetail(true);
  }

  function handleAddPlayer() {
    if (!detailPlayer || squadLocked) return;

    if (activeSlotIndex !== null) {
      addPlayer(activeSlotIndex, detailPlayer);
    } else {
      const emptySlotIdx = formation.slots.findIndex(
        (s, i) => s.position === detailPlayer.position && slots[i] === null
      );
      if (emptySlotIdx !== -1) {
        addPlayer(emptySlotIdx, detailPlayer);
      } else {
        const anyEmpty = slots.findIndex((s) => s === null);
        if (anyEmpty !== -1) {
          addPlayer(anyEmpty, detailPlayer);
        }
      }
    }
    setShowDetail(false);
    setDetailPlayer(null);
  }

  function handleRemovePlayer() {
    if (!detailPlayer || squadLocked) return;
    const idx = slots.findIndex((p) => p?.id === detailPlayer.id);
    if (idx !== -1) removePlayer(idx);
    setShowDetail(false);
    setDetailPlayer(null);
  }

  function handleAutoFill() {
    if (!loaded || squadLocked) return;
    const sortedPlayers = [...players].sort((a, b) => b.overall - a.overall);

    formation.slots.forEach((slot, i) => {
      if (slots[i] !== null) return;
      const remaining = useSquadStore.getState().budgetRemaining();
      const available = sortedPlayers.find(
        (p) =>
          p.position === slot.position &&
          !useSquadStore.getState().isPlayerInSquad(p.id) &&
          p.marketValue <= remaining
      );
      if (available) {
        useSquadStore.getState().addPlayer(i, available);
      }
    });
  }

  async function handleSaveSquad() {
    const currentSlots = useSquadStore.getState().slots;
    const filled = currentSlots.filter((p): p is Player => p !== null);
    if (filled.length < 11) return;

    setSaving(true);
    setSaveStatus("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Delete existing starters and re-insert
    await supabase
      .from("squads")
      .delete()
      .eq("user_id", user.id)
      .eq("is_starter", true);

    const rows = currentSlots
      .map((player, i) => player ? {
        user_id: user.id,
        player_id: player.id,
        position_slot: i,
        is_starter: true,
      } : null)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const { error } = await supabase.from("squads").insert(rows);

    setSaving(false);
    if (error) {
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2500);
    }
  }

  async function handleConfirmForRanked() {
    await handleSaveSquad();

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        squad_locked: true,
        ranked_matches_in_cycle: 0,
        transfers_remaining: 0,
        squad_confirmed_at: new Date().toISOString(),
        cycle_id: (profile?.cycle_id ?? 0) + 1,
      })
      .eq("id", user.id);

    if (!error) {
      setProfile((prev) => prev ? {
        ...prev,
        squad_locked: true,
        ranked_matches_in_cycle: 0,
        transfers_remaining: 0,
        squad_confirmed_at: new Date().toISOString(),
        cycle_id: (prev.cycle_id ?? 0) + 1,
      } : prev);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cycle status */}
      {profile && <CycleStatus profile={profile} />}

      {/* Formation selector */}
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border bg-surface">
        {FORMATIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => !squadLocked && setFormation(f.id)}
            disabled={squadLocked}
            className={cn(
              "shrink-0 h-8 px-3 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
              formationId === f.id
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light",
              squadLocked && "opacity-50"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Position needs */}
      <PositionGuide />

      {/* Budget */}
      <BudgetBar />

      {/* Pitch */}
      <div className="px-4 py-3">
        <PitchView />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-2">
        {!squadLocked && (
          <>
            <button
              onClick={handleAutoFill}
              className="flex-1 h-9 border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Auto-fill
            </button>
            <button
              onClick={() => !squadLocked && clearSquad()}
              className="flex-1 h-9 border border-border text-text-dim font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Player market */}
      <div className="flex-1 min-h-0 border-t border-border">
        {loaded ? (
          <PlayerMarket
            players={players}
            onSelectPlayer={handleSelectPlayer}
            filterPosition={filterPos}
            disabled={squadLocked}
          />
        ) : (
          <div className="p-4">
            <div className="h-3 bg-border rounded-sm w-32 mb-2 animate-pulse" />
            <div className="h-3 bg-border rounded-sm w-48 mb-2 animate-pulse" />
            <div className="h-3 bg-border rounded-sm w-40 animate-pulse" />
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-14 bg-surface border-t border-border px-4 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-mono text-xs text-text-mid">
            Squad {filledCount()}/11
          </span>
          <span className="font-mono text-xs text-gold tabular-nums ml-2">
            {formatPrice(totalSpent())} spent
          </span>
        </div>

        {filledCount() >= 11 && !squadLocked && (
          <button
            onClick={handleSaveSquad}
            disabled={saving}
            className={cn(
              "h-9 px-4 rounded-[4px] font-mono text-[11px] uppercase tracking-wide flex items-center gap-1.5 transition-colors duration-100",
              saveStatus === "saved"
                ? "bg-accent/20 text-accent border border-accent"
                : "bg-accent text-black hover:bg-accent-dim",
              saving && "opacity-60"
            )}
          >
            {saving ? "..." : saveStatus === "saved" ? (
              <><Check size={14} strokeWidth={2} /> Saved</>
            ) : (
              <><Save size={14} strokeWidth={1.5} /> Save</>
            )}
          </button>
        )}

        {filledCount() >= 11 && !squadLocked && (
          <button
            onClick={handleConfirmForRanked}
            disabled={saving}
            className="h-9 px-4 bg-gold/20 text-gold border border-gold rounded-[4px] font-mono text-[11px] uppercase tracking-wide hover:bg-gold/30 transition-colors duration-100"
          >
            Lock for Ranked
          </button>
        )}
      </div>

      {/* Player detail sheet */}
      <PlayerDetail
        player={detailPlayer}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setDetailPlayer(null);
        }}
        onAdd={squadLocked ? undefined : handleAddPlayer}
        onRemove={squadLocked ? undefined : handleRemovePlayer}
        inSquad={detailPlayer ? isPlayerInSquad(detailPlayer.id) : false}
        canAfford={detailPlayer ? canAfford(detailPlayer) : false}
      />
    </div>
  );
}
