"use client";

import { useEffect, useRef } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import { cn } from "@/lib/utils";
import type { MatchEvent } from "@/lib/types";

function eventIcon(type: string): string {
  switch (type) {
    case "goal": return "\u26BD";
    case "yellow_card": return "\uD83D\uDFE8";
    case "red_card": return "\uD83D\uDFE5";
    case "shot_saved": return "\uD83E\uDDE4";
    case "shot_missed": return "\u274C";
    case "shot_blocked": return "\uD83D\uDEE1\uFE0F";
    case "corner": return "\u2690";
    case "foul": return "\u26A0";
    case "substitution": return "\uD83D\uDD04";
    case "free_kick": return "\u25CE";
    case "chance_created": return "\u2728";
    case "tackle": return "\uD83E\uDDB6";
    case "interception": return "\u270B";
    default: return "";
  }
}

function KeyMomentCard({ event }: { event: MatchEvent }) {
  const isGoal = event.type === "goal";
  const isRedCard = event.type === "red_card";

  return (
    <div className={cn(
      "mx-4 my-2 p-3 rounded-md border",
      isGoal && "bg-accent/8 border-accent/40",
      isRedCard && "bg-danger/8 border-danger/40",
      !isGoal && !isRedCard && "bg-surface-alt border-border-light"
    )}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5">
          {eventIcon(event.type)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono text-[10px] font-medium uppercase tracking-wide",
              isGoal ? "text-accent" : isRedCard ? "text-danger" : "text-gold"
            )}>
              {event.type === "goal" ? "GOAL" :
               event.type === "red_card" ? "RED CARD" :
               event.type === "yellow_card" ? "YELLOW CARD" :
               event.type === "shot_saved" ? "BIG SAVE" : event.type.replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="font-mono text-[10px] text-text-dim tabular-nums">
              {event.minute}&apos;
            </span>
          </div>
          {event.primaryPlayer && (
            <p className="font-mono text-xs text-text font-medium mt-0.5">
              {event.primaryPlayer}
              {event.secondaryPlayer && (
                <span className="text-text-dim font-normal"> (assist: {event.secondaryPlayer})</span>
              )}
            </p>
          )}
          <p className="font-mono text-[11px] text-text-mid mt-0.5">
            {event.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function HalftimeSummary() {
  const { stats, homeScore, awayScore } = useMatchStore();
  if (!stats) return null;

  return (
    <div className="mx-4 my-3 bg-surface-alt border border-border rounded-md p-3">
      <p className="font-mono text-[10px] text-text-dim uppercase tracking-wide text-center mb-2">
        Half Time
      </p>
      <p className="font-mono text-xl font-semibold text-center tabular-nums">
        <span className="text-home">{homeScore}</span>
        <span className="text-text-dim mx-1.5">-</span>
        <span className="text-away">{awayScore}</span>
      </p>
      <div className="flex justify-center gap-6 mt-2">
        <MiniStat label="Poss" home={stats.homePossession} away={stats.awayPossession} suffix="%" />
        <MiniStat label="Shots" home={stats.homeShots} away={stats.awayShots} />
      </div>
    </div>
  );
}

function MiniStat({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[10px] text-text-dim uppercase">{label}</p>
      <p className="font-mono text-xs tabular-nums">
        <span className="text-home">{home}{suffix}</span>
        <span className="text-text-dim mx-1">-</span>
        <span className="text-away">{away}{suffix}</span>
      </p>
    </div>
  );
}

export default function EventFeed() {
  const { visibleEvents, keyEventsOnly } = useMatchStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const events = keyEventsOnly
    ? visibleEvents.filter((e) => e.isKeyEvent)
    : visibleEvents;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="flex-1 overflow-y-auto">
      {events.map((event, i) => {
        // Key moments get special cards
        if (event.type === "goal" || event.type === "red_card") {
          return <KeyMomentCard key={i} event={event} />;
        }

        // Halftime gets a summary
        if (event.type === "halftime") {
          return <HalftimeSummary key={i} />;
        }

        // Fulltime
        if (event.type === "fulltime") {
          return (
            <div key={i} className="bg-surface-alt border-y border-border px-4 py-3 text-center">
              <p className="font-mono text-xs text-text-dim uppercase tracking-wide">
                {event.description}
              </p>
            </div>
          );
        }

        // Kickoff
        if (event.type === "kickoff") {
          return (
            <div key={i} className="bg-surface-alt border-b border-border px-4 py-2 text-center">
              <p className="font-mono text-xs text-text-dim uppercase tracking-wide">
                {event.description}
              </p>
            </div>
          );
        }

        // Yellow card — inline but highlighted
        if (event.type === "yellow_card") {
          return (
            <div key={i} className="flex gap-0 px-4 py-2 border-l-2 border-gold bg-gold/5">
              <span className="font-mono text-xs text-text-dim tabular-nums w-9 shrink-0 text-right mr-3">
                {event.minute}&apos;
              </span>
              <span className="mr-1.5">{eventIcon(event.type)}</span>
              <span className="font-mono text-xs text-text">{event.description}</span>
            </div>
          );
        }

        // Shot saved — slight highlight
        if (event.type === "shot_saved") {
          return (
            <div key={i} className="flex gap-0 px-4 py-2 border-l-2 border-home/40">
              <span className="font-mono text-xs text-text-dim tabular-nums w-9 shrink-0 text-right mr-3">
                {event.minute}&apos;
              </span>
              <span className="font-mono text-xs text-text-mid">{event.description}</span>
            </div>
          );
        }

        // Default event
        const icon = eventIcon(event.type);
        return (
          <div
            key={i}
            className="flex gap-0 px-4 py-1.5"
          >
            <span className="font-mono text-xs text-text-dim tabular-nums w-9 shrink-0 text-right mr-3">
              {event.minute}&apos;
            </span>
            {icon && <span className="mr-1.5 text-xs">{icon}</span>}
            <span className={cn(
              "font-mono text-xs",
              event.isKeyEvent ? "text-text" : "text-text-mid"
            )}>
              {event.description}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
