"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import { getFormation } from "@/lib/data/formations";

export default function MatchPitch() {
  const { homeFormation, awayFormation, currentPossession, visibleEvents, isFinished } =
    useMatchStore();
  const [goalFlash, setGoalFlash] = useState<{ team: "home" | "away"; x: number; y: number } | null>(null);

  const homeFm = getFormation(homeFormation);
  const awayFm = getFormation(awayFormation);

  // Possession shift offset
  const homeShift = currentPossession === "home" ? -3 : 3;
  const awayShift = currentPossession === "away" ? -3 : 3;

  // Goal flash effect
  useEffect(() => {
    if (visibleEvents.length === 0) return;
    const lastEvent = visibleEvents[visibleEvents.length - 1];
    if (lastEvent.type === "goal") {
      const isHome = lastEvent.team === "home";
      setGoalFlash({
        team: lastEvent.team as "home" | "away",
        x: 50,
        y: isHome ? 5 : 95,
      });
      const timer = setTimeout(() => setGoalFlash(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [visibleEvents.length]);

  if (isFinished) return null;

  return (
    <div className="mx-4 my-2">
      <svg
        viewBox="0 0 200 120"
        className="w-full rounded-md border border-border overflow-hidden"
        style={{ backgroundColor: "#0d2818", maxHeight: "120px" }}
      >
        {/* Pitch markings */}
        <rect x="0" y="0" width="200" height="120" fill="none" stroke="rgba(34,197,94,0.2)" strokeWidth="0.5" />
        <line x1="100" y1="0" x2="100" y2="120" stroke="rgba(34,197,94,0.15)" strokeWidth="0.4" />
        <circle cx="100" cy="60" r="15" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.4" />
        <circle cx="100" cy="60" r="1" fill="rgba(34,197,94,0.2)" />
        {/* Left penalty box */}
        <rect x="0" y="30" width="25" height="60" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.4" />
        {/* Right penalty box */}
        <rect x="175" y="30" width="25" height="60" fill="none" stroke="rgba(34,197,94,0.15)" strokeWidth="0.4" />
        {/* Goals */}
        <rect x="-1" y="48" width="3" height="24" fill="none" stroke="rgba(34,197,94,0.25)" strokeWidth="0.3" />
        <rect x="198" y="48" width="3" height="24" fill="none" stroke="rgba(34,197,94,0.25)" strokeWidth="0.3" />

        {/* Home team dots (left side, attacking right) */}
        {homeFm.slots.map((slot, i) => {
          // Map formation y (0=attack, 100=GK) to pitch x (left=GK, right=attack)
          const px = ((100 - slot.y) / 100) * 90 + 5 + homeShift;
          // Map formation x to pitch y
          const py = (slot.x / 100) * 100 + 10;
          return (
            <circle
              key={`h${i}`}
              cx={px}
              cy={py}
              r="3.5"
              fill="#22c55e"
              opacity="0.85"
              className="transition-all duration-1000"
            />
          );
        })}

        {/* Away team dots (right side, attacking left) */}
        {awayFm.slots.map((slot, i) => {
          // Mirror: GK on right, attackers on left
          const px = (slot.y / 100) * 90 + 105 + awayShift;
          // Mirror x axis
          const py = ((100 - slot.x) / 100) * 100 + 10;
          return (
            <circle
              key={`a${i}`}
              cx={px}
              cy={py}
              r="3.5"
              fill="#ef4444"
              opacity="0.7"
              className="transition-all duration-1000"
            />
          );
        })}

        {/* Goal flash animation */}
        {goalFlash && (
          <>
            <text
              x={goalFlash.team === "home" ? 185 : 15}
              y="62"
              textAnchor="middle"
              fontSize="14"
              className="animate-pulse"
            >
              ⚽
            </text>
            <circle
              cx={goalFlash.team === "home" ? 185 : 15}
              cy="60"
              r="8"
              fill="none"
              stroke={goalFlash.team === "home" ? "#22c55e" : "#ef4444"}
              strokeWidth="1"
              opacity="0.6"
              className="animate-ping"
            >
              <animate attributeName="r" from="5" to="15" dur="0.8s" repeatCount="2" />
              <animate attributeName="opacity" from="0.8" to="0" dur="0.8s" repeatCount="2" />
            </circle>
          </>
        )}
      </svg>
    </div>
  );
}
