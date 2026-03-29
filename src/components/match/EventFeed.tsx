"use client";

import { useEffect, useRef } from "react";
import { useMatchStore } from "@/lib/stores/match-store";
import { cn } from "@/lib/utils";

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
      {events.map((event, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-0 px-4 py-2",
            event.type === "goal" && "border-l-2 border-accent bg-accent/5",
            event.type === "yellow_card" && "border-l-2 border-gold",
            event.type === "red_card" && "border-l-2 border-danger bg-danger-dim/10",
            (event.type === "halftime" || event.type === "fulltime") &&
              "bg-surface-alt border-y border-border justify-center",
            event.type === "kickoff" && "bg-surface-alt border-b border-border justify-center"
          )}
        >
          {event.type !== "kickoff" &&
            event.type !== "halftime" &&
            event.type !== "fulltime" && (
              <span className="font-mono text-xs text-text-dim tabular-nums w-9 shrink-0 text-right mr-3">
                {event.minute}&apos;
              </span>
            )}
          <span
            className={cn(
              "font-mono text-xs",
              event.isKeyEvent ? "text-text" : "text-text-mid",
              (event.type === "halftime" ||
                event.type === "fulltime" ||
                event.type === "kickoff") &&
                "text-text-dim uppercase tracking-wide text-center"
            )}
          >
            {event.description}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
