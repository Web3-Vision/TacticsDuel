"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSquadStore } from "@/lib/stores/squad-store";
import { useMatchStore } from "@/lib/stores/match-store";
import { simulateMatch } from "@/lib/engine/match-engine";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import PitchView from "@/components/pitch/PitchView";
import { cn } from "@/lib/utils";
import type { Player, Tactics } from "@/lib/types";

const DEFAULT_TACTICS: Tactics = {
  formation: "4-3-3",
  mentality: "Balanced",
  tempo: "Normal",
  pressing: "Medium",
  width: "Normal",
};

const AI_CLUB_NAMES = [
  "FC Dynamo", "Athletic United", "Real Sportivo", "Inter Calcio",
  "Olympique FC", "Borussia City", "Sporting Lisbon B", "Galatasaray II",
  "Red Star FC", "Zenit Academy", "AS Monaco B", "Club Brugge II",
  "Shakhtar Youth", "Benfica Reserves", "Ajax Development", "PSV Next",
];

function pickAIClubName(): string {
  return AI_CLUB_NAMES[Math.floor(Math.random() * AI_CLUB_NAMES.length)];
}

function avgOverall(squad: (Player | null)[]): number {
  const players = squad.filter((p): p is Player => p !== null);
  if (players.length === 0) return 0;
  return Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length);
}

export default function PreMatchConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "ai";

  const { slots, formationId, filledCount } = useSquadStore();
  const loadMatch = useMatchStore((s) => s.loadMatch);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [tactics, setTactics] = useState<Tactics>(DEFAULT_TACTICS);

  // Pre-generated AI opponent
  const [aiSquad, setAiSquad] = useState<Player[]>([]);
  const [aiTactics, setAiTactics] = useState<Tactics | null>(null);
  const [aiClubName, setAiClubName] = useState("");

  useEffect(() => {
    import("@/lib/data/players").then((mod) => setPlayers(mod.PLAYERS));
  }, []);

  // Load saved tactics from Supabase
  useEffect(() => {
    async function loadTactics() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("tactics")
          .select("mentality, tempo, pressing, width")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setTactics({
            formation: formationId,
            mentality: data.mentality ?? "Balanced",
            tempo: data.tempo ?? "Normal",
            pressing: data.pressing ?? "Medium",
            width: data.width ?? "Normal",
          });
        }
      } catch {
        // Use defaults on error
      }
    }
    loadTactics();
  }, [formationId]);

  // Pre-generate AI opponent when players are loaded
  useEffect(() => {
    if (mode !== "ai" || players.length === 0) return;
    const formation = getFormation(formationId);
    const positions = formation.slots.map((s) => s.position);
    setAiSquad(generateAISquad(players, positions));
    setAiTactics(generateAITactics());
    setAiClubName(pickAIClubName());
  }, [mode, players, formationId]);

  const squadReady = filledCount() >= 11;
  const formation = getFormation(formationId);

  const homeOvr = useMemo(() => avgOverall(slots), [slots]);
  const awayOvr = useMemo(() => avgOverall(aiSquad), [aiSquad]);

  function handleStartMatch() {
    if (!squadReady || players.length === 0) return;
    setLoading(true);

    const homeSquad = slots.filter((p): p is Player => p !== null);
    const homeTactics: Tactics = {
      ...tactics,
      formation: formationId,
    };

    if (mode === "ai") {
      // Use pre-generated opponent
      const awaySquad = aiSquad.length > 0 ? aiSquad : generateAISquad(players, formation.slots.map((s) => s.position));
      const awayTactics = aiTactics ?? generateAITactics();

      const result = simulateMatch({
        homeSquad,
        awaySquad,
        homeTactics,
        awayTactics,
        matchType: "ai",
      });

      loadMatch(result, "Your Team", aiClubName || "AI FC");
      router.push("/match/live");
    } else if (mode === "ranked") {
      router.push("/match/queue");
    }
  }

  const modeLabel =
    mode === "ai"
      ? "VS AI"
      : mode === "ranked"
        ? "Ranked Match"
        : "Friendly Match";

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg uppercase tracking-wide">
          {modeLabel}
        </h1>
        <button
          onClick={() => router.back()}
          className="font-mono text-xs text-text-dim uppercase tracking-wide"
        >
          Back
        </button>
      </div>

      {!squadReady && (
        <div className="bg-surface-alt border border-border rounded-md p-3">
          <p className="font-mono text-xs text-gold">
            You need at least 11 players in your squad ({filledCount()}/11)
          </p>
        </div>
      )}

      {/* Squad rating comparison */}
      {mode === "ai" && aiSquad.length > 0 && (
        <div className="bg-surface border border-border rounded-md p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center flex-1">
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide">Your Team</span>
              <span className={cn(
                "font-mono text-2xl font-semibold tabular-nums mt-1",
                homeOvr >= awayOvr ? "text-win" : "text-text-mid"
              )}>
                {homeOvr}
              </span>
              <span className="font-mono text-[10px] text-text-dim uppercase">OVR</span>
            </div>
            <div className="flex flex-col items-center px-4">
              <span className="font-mono text-xs text-text-dim">VS</span>
            </div>
            <div className="flex flex-col items-center flex-1">
              <span className="font-mono text-[10px] text-text-dim uppercase tracking-wide truncate max-w-[120px]">
                {aiClubName}
              </span>
              <span className={cn(
                "font-mono text-2xl font-semibold tabular-nums mt-1",
                awayOvr >= homeOvr ? "text-away" : "text-text-mid"
              )}>
                {awayOvr}
              </span>
              <span className="font-mono text-[10px] text-text-dim uppercase">OVR</span>
            </div>
          </div>
        </div>
      )}

      {/* Formation comparison */}
      <div className="bg-surface border border-border rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
            Your Formation
          </span>
          <span className="font-mono text-xs text-text-mid">
            {formation.name}
          </span>
        </div>
        <PitchView />
        {mode === "ai" && aiTactics && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
              Opponent Formation
            </span>
            <span className="font-mono text-xs text-text-mid">
              {aiTactics.formation}
            </span>
          </div>
        )}
      </div>

      {/* Tactics summary */}
      <div className="bg-surface border border-border rounded-md p-3">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide block mb-2">
          Tactics
        </span>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Mentality", value: tactics.mentality },
            { label: "Tempo", value: tactics.tempo },
            { label: "Pressing", value: tactics.pressing },
            { label: "Width", value: tactics.width },
          ].map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-1.5 px-2 py-1 bg-bg border border-border rounded-[3px]"
            >
              <span className="font-mono text-[10px] text-text-dim uppercase">
                {t.label}
              </span>
              <span className="font-mono text-[11px] text-text-mid">
                {t.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit links */}
      <div className="flex gap-2">
        <Link
          href="/club/squad"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Edit Squad
        </Link>
        <Link
          href="/club/tactics"
          className="flex-1 block h-10 leading-[40px] text-center border border-border text-text-mid font-mono text-[11px] uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Edit Tactics
        </Link>
      </div>

      {/* Kick Off */}
      <button
        onClick={handleStartMatch}
        disabled={!squadReady || loading}
        className="w-full h-14 bg-accent text-black font-mono text-md font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40"
      >
        {loading ? "Loading..." : "Kick Off"}
      </button>
    </div>
  );
}
