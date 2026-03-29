"use client";

import { useEffect, useRef } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import Scoreboard from "./Scoreboard";
import EventFeed from "./EventFeed";
import MatchControls from "./MatchControls";
import PostMatchStats from "./PostMatchStats";

export default function MatchViewer() {
  const { isPlaying, isFinished, speed, tick } = useMatchStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const delay = speed === 1 ? 1500 : speed === 2 ? 800 : 350;
      intervalRef.current = setInterval(tick, delay);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, tick]);

  return (
    <div className="flex flex-col h-full">
      <Scoreboard />
      {isFinished ? <PostMatchStats /> : (
        <>
          <EventFeed />
          <MatchControls />
        </>
      )}
    </div>
  );
}
