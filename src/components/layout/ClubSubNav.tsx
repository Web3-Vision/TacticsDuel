"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/club/team-hub", label: "Team Hub" },
  { href: "/club/squad", label: "Squad" },
  { href: "/club/tactics", label: "Tactics" },
  { href: "/club/market", label: "Market" },
  { href: "/club/leaderboard", label: "Leaderboard" },
];

export default function ClubSubNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-12 z-40 bg-surface border-b border-border">
      <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-[4px] border transition-colors duration-100",
                isActive
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-text-dim hover:border-border-light"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
