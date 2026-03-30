"use client";

import { useRef, useCallback } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import { simulateSecondHalf, type TacticalOverride } from "@/lib/engine/match-engine";
import MatchViewer from "@/components/match/MatchViewer";
import type { MatchConfig, PhaseResult } from "@/lib/types";

// Store match config and first half result for interactive simulation
let storedConfig: MatchConfig | null = null;
let storedFirstHalfResult: PhaseResult | null = null;
let storedSeed: number | null = null;

export function setInteractiveMatchData(
  config: MatchConfig,
  firstHalfResult: PhaseResult,
  seed: number
) {
  storedConfig = config;
  storedFirstHalfResult = firstHalfResult;
  storedSeed = seed;
}

export default function LiveMatchPage() {
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const isInteractive = useRef(!!storedConfig);

  const handleHalftimeIntervention = useCallback((override: TacticalOverride | null) => {
    if (!storedConfig || !storedFirstHalfResult || storedSeed === null) return;

    // Simulate second half with the player's tactical override
    const result = simulateSecondHalf(
      storedConfig,
      storedFirstHalfResult,
      override,
      null, // AI away tactics are auto-determined
      storedSeed,
    );

    // Append second half events to the match store
    const store = useMatchStore.getState();
    const currentEvents = store.events;
    const secondHalfEvents = result.events;

    // Replace the store's events array: keep first half events, add second half
    useMatchStore.setState({
      events: [...currentEvents, ...secondHalfEvents],
      stats: result.stats,
      playerRatings: result.playerRatings,
      manOfTheMatch: result.manOfTheMatch,
    });

    // Clean up
    storedConfig = null;
    storedFirstHalfResult = null;
    storedSeed = null;
  }, []);

  return (
    <MatchViewer
      interactive={isInteractive.current}
      onHalftimeIntervention={handleHalftimeIntervention}
    />
  );
}
