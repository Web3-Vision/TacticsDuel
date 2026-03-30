"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSquadStore } from "@/lib/stores/squad-store";
import { useMatchStore } from "@/lib/stores/match-store";
import { simulateFirstHalf } from "@/lib/engine/match-engine";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import { createClient } from "@/lib/supabase/client";
import { setInteractiveMatchData } from "@/app/(game)/match/live/page";
import type { Player, Tactics, Profile, MatchConfig } from "@/lib/types";
import { Swords, Users, Bot, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PlayPage() {
  const router = useRouter();
  const { slots, formationId, filledCount } = useSquadStore();
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [squadSaved, setSquadSaved] = useState(false);
  const [tacticsSaved, setTacticsSaved] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => setPlayers(mod.PLAYERS));
  }, []);

  // Check if squad and tactics are saved to DB, and load profile
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      const [profileRes, squadRes, tacticsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("squads").select("id").eq("user_id", user.id).eq("is_starter", true),
        supabase.from("tactics").select("id").eq("user_id", user.id).single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      setSquadSaved((squadRes.data?.length ?? 0) >= 11);
      setTacticsSaved(!!tacticsRes.data);
      setChecking(false);
    }
    check();
  }, []);

  const squadReady = filledCount() >= 11;
  const rankedReady = squadReady && squadSaved && tacticsSaved && profile?.squad_locked;

  function handlePlayAI() {
    if (!squadReady || players.length === 0) return;
    setLoading(true);

    const formation = getFormation(formationId);
    const positions = formation.slots.map((s) => s.position);

    const homeSquad = slots.filter((p): p is Player => p !== null);
    const homeTactics: Tactics = {
      formation: formationId,
      mentality: "Balanced",
      tempo: "Normal",
      pressing: "Medium",
      width: "Normal",
    };

    const awaySquad = generateAISquad(players, positions);
    const awayTactics = generateAITactics();

    const config: MatchConfig = {
      homeSquad,
      awaySquad,
      homeTactics,
      awayTactics,
      matchType: "ai",
    };

    // Simulate first half only, then let player make halftime intervention
    const { result: firstHalfResult, events: firstHalfEvents, seed } = simulateFirstHalf(config);

    // Store data for interactive second half
    setInteractiveMatchData(config, firstHalfResult, seed);

    // Load first half events into match store
    loadMatch(
      {
        events: firstHalfEvents,
        homeScore: firstHalfResult.homeScore,
        awayScore: firstHalfResult.awayScore,
        stats: {
          homePossession: Math.round((firstHalfResult.homePossCount / Math.max(1, firstHalfResult.homePossCount + firstHalfResult.awayPossCount)) * 100),
          awayPossession: Math.round((firstHalfResult.awayPossCount / Math.max(1, firstHalfResult.homePossCount + firstHalfResult.awayPossCount)) * 100),
          homeShots: firstHalfResult.homeShots,
          awayShots: firstHalfResult.awayShots,
          homeOnTarget: firstHalfResult.homeOnTarget,
          awayOnTarget: firstHalfResult.awayOnTarget,
          homeCorners: firstHalfResult.homeCorners,
          awayCorners: firstHalfResult.awayCorners,
          homeFouls: firstHalfResult.homeFouls,
          awayFouls: firstHalfResult.awayFouls,
          homeYellowCards: firstHalfResult.homeYellows,
          awayYellowCards: firstHalfResult.awayYellows,
          homeRedCards: firstHalfResult.homeReds,
          awayRedCards: firstHalfResult.awayReds,
          homePassAccuracy: 70,
          awayPassAccuracy: 70,
        },
        playerRatings: {},
        manOfTheMatch: "",
      },
      "Your Team",
      "AI FC"
    );
    router.push("/match/live");
  }

  function handlePlayRanked() {
    if (!rankedReady) return;
    router.push("/match/queue");
  }

  // Determine ranked button message
  let rankedMessage = "Climb the divisions";
  if (!squadReady) rankedMessage = `Need 11 players (${filledCount()}/11)`;
  else if (!squadSaved) rankedMessage = "Save your squad first";
  else if (!tacticsSaved) rankedMessage = "Save your tactics first";
  else if (!profile?.squad_locked) rankedMessage = "Lock squad for ranked first";

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-mono text-lg uppercase tracking-wide">Play</h1>

      {!squadReady && (
        <div className="bg-surface-alt border border-border rounded-md p-3">
          <p className="font-mono text-xs text-gold">
            Build your squad first ({filledCount()}/11 players)
          </p>
        </div>
      )}

      {/* VS AI */}
      <button
        onClick={handlePlayAI}
        disabled={!squadReady || loading}
        className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
      >
        <Bot size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">VS AI</p>
          <p className="text-text-dim text-xs mt-0.5">
            Practice match against computer
          </p>
        </div>
      </button>

      {/* Ranked */}
      <button
        onClick={handlePlayRanked}
        disabled={!rankedReady || loading || checking}
        className={cn(
          "w-full bg-surface border rounded-md p-4 flex items-center gap-4 transition-colors duration-100 text-left",
          rankedReady
            ? "border-accent/40 hover:border-accent"
            : "border-border disabled:opacity-40"
        )}
      >
        <Swords size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">Ranked</p>
          <p className={cn(
            "text-xs mt-0.5",
            rankedReady ? "text-text-dim" : "text-gold"
          )}>
            {checking ? "Checking..." : rankedMessage}
          </p>
        </div>
        {profile?.squad_locked && (
          <Lock size={14} strokeWidth={1.5} className="text-accent shrink-0" />
        )}
      </button>

      {/* Friend */}
      <button
        disabled={!squadReady}
        className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
      >
        <Users size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">
            VS Friend
          </p>
          <p className="text-text-dim text-xs mt-0.5">
            Challenge a friend
          </p>
        </div>
      </button>

      {/* Ranked readiness checklist */}
      {squadReady && !rankedReady && !checking && (
        <div className="bg-surface border border-border rounded-md p-3 flex flex-col gap-1.5">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide mb-1">
            Ranked Checklist
          </p>
          <CheckItem done={squadSaved} label="Squad saved to server" />
          <CheckItem done={tacticsSaved} label="Tactics configured & saved" />
          <CheckItem done={profile?.squad_locked ?? false} label="Squad locked for ranked" />
        </div>
      )}
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-3 h-3 rounded-sm flex items-center justify-center",
        done ? "bg-accent/20" : "bg-border"
      )}>
        {done && <span className="text-accent text-[8px] font-bold">✓</span>}
      </div>
      <span className={cn(
        "font-mono text-xs",
        done ? "text-text-mid" : "text-text-dim"
      )}>
        {label}
      </span>
    </div>
  );
}
