"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSquadStore } from "@/lib/stores/squad-store";
import { useMatchStore } from "@/lib/stores/match-store";
import { simulateMatch } from "@/lib/engine/match-engine";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import type { Player, Tactics } from "@/lib/types";
import { Swords, Users, Bot } from "lucide-react";

export default function PlayPage() {
  const router = useRouter();
  const { slots, formationId, filledCount } = useSquadStore();
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => setPlayers(mod.PLAYERS));
  }, []);

  const squadReady = filledCount() >= 11;

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

    const result = simulateMatch({
      homeSquad,
      awaySquad,
      homeTactics,
      awayTactics,
      matchType: "ai",
    });

    loadMatch(result, "Your Team", "AI FC");
    router.push("/match/live");
  }

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
        disabled={!squadReady}
        className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
      >
        <Swords size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">Ranked</p>
          <p className="text-text-dim text-xs mt-0.5">
            Climb the divisions
          </p>
        </div>
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
    </div>
  );
}
