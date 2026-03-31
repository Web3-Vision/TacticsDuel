"use client";

import { useEffect, useRef, useState } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import Scoreboard from "./Scoreboard";
import EventFeed from "./EventFeed";
import MatchControls from "./MatchControls";
import MatchPitch from "./MatchPitch";
import PostMatchStats from "./PostMatchStats";
import TacticalIntervention from "./TacticalIntervention";
import type { TacticalOverride } from "@/lib/engine/match-engine";

interface MatchViewerProps {
  onHalftimeIntervention?: (override: TacticalOverride | null) => void;
  interactive?: boolean;
}

export default function MatchViewer({ onHalftimeIntervention, interactive = false }: MatchViewerProps) {
  const { isPlaying, isFinished, speed, homeScore, awayScore, stats } = useMatchStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showIntervention, setShowIntervention] = useState(false);
  const interventionShownRef = useRef(false);

  useEffect(() => {
    if (isPlaying) {
      const delay = speed === 1 ? 1500 : speed === 2 ? 800 : 350;
      intervalRef.current = setInterval(() => {
        const store = useMatchStore.getState();
        const nextEvent = store.events[store.currentIndex];

        // Check if we're about to play the halftime event and we're interactive
        if (interactive && nextEvent?.type === "halftime" && !interventionShownRef.current) {
          // Play the halftime event first
          store.tick();
          // Then pause for intervention
          if (intervalRef.current) clearInterval(intervalRef.current);
          interventionShownRef.current = true;
          setShowIntervention(true);
          return;
        }

        store.tick();
      }, delay);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, interactive]);

  function handleIntervention(override: TacticalOverride | null) {
    setShowIntervention(false);
    if (onHalftimeIntervention) {
      onHalftimeIntervention(override);
    }
    // Resume playback
    useMatchStore.setState({ isPlaying: true });
  }

  return (
    <div className="flex flex-col h-full relative">
      <Scoreboard />
      {isFinished ? (
        <PostMatchStats />
      ) : (
        <>
          <MatchPitch />
          <EventFeed />
          <MatchControls />
        </>
      )}
      {showIntervention && (
        <TacticalIntervention
          homeScore={homeScore}
          awayScore={awayScore}
          possession={stats?.homePossession ?? 50}
          shots={{ home: stats?.homeShots ?? 0, away: stats?.awayShots ?? 0 }}
          onConfirm={handleIntervention}
        />
      )}
    </div>
  );
}
