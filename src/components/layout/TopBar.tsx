"use client";

import { Trophy, Coins } from "lucide-react";
import type { Profile } from "@/lib/types";
import { DIVISIONS } from "@/lib/utils";

interface TopBarProps {
  profile: Profile | null;
}

export default function TopBar({ profile }: TopBarProps) {
  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division)
    : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-surface border-b border-border pt-safe">
      <div className="flex items-center h-full px-4 max-w-[480px] mx-auto">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[13px] text-text truncate">
          {profile?.club_name ?? "TacticsDuel"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 mx-3">
        <Trophy size={14} strokeWidth={1.5} className="text-gold" />
        <span className="font-mono text-xs text-text-mid">
          {division ? `Div ${division.id}` : "--"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Coins size={14} strokeWidth={1.5} className="text-gold" />
        <span className="font-mono text-xs text-text-mid tabular-nums">
          {profile?.coins ?? 0}
        </span>
      </div>
      </div>
    </header>
  );
}
