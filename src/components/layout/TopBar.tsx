"use client";

import Link from "next/link";
import { Trophy, Coins, UserCircle2 } from "lucide-react";
import type { Profile } from "@/lib/types";
import { DIVISIONS } from "@/lib/utils";

interface TopBarProps {
  profile: Profile | null;
}

export default function TopBar({ profile }: TopBarProps) {
  const division = profile
    ? DIVISIONS.find((d) => d.id === profile.division)
    : null;

  const initial = profile?.username?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-surface/85 pt-safe backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[760px] items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim">
            Active Club
          </p>
          <p className="truncate font-mono text-sm text-text">
            {profile?.club_name ?? "TacticsDuel"}
          </p>
        </div>

        <div className="hidden items-center gap-1 rounded-md border border-border/70 bg-bg/55 px-2 py-1 sm:flex">
          <Trophy size={13} strokeWidth={1.7} className="text-gold" />
          <span className="font-mono text-[11px] text-text-mid">
            {division ? `Div ${division.id}` : "Unranked"}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/70 bg-bg/55 px-2 py-1">
          <Coins size={13} strokeWidth={1.7} className="text-gold" />
          <span className="font-mono text-[11px] text-text-mid tabular-nums">
            {profile?.coins ?? 0}
          </span>
        </div>

        <Link
          href="/profile"
          className="flex h-8 items-center gap-1 rounded-md border border-border/80 bg-surface-alt px-2 text-[11px] font-semibold text-text-mid transition-colors duration-150 hover:border-accent hover:text-text"
          aria-label="Open profile"
        >
          <UserCircle2 size={12} strokeWidth={1.8} />
          <span className="font-mono">{initial} Profile</span>
        </Link>
      </div>
    </header>
  );
}
