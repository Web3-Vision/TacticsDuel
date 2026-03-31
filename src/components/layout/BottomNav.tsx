"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, PlayCircle, Users, ShoppingBag, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Home", icon: LayoutGrid },
  { href: "/play", label: "Play", icon: PlayCircle },
  { href: "/club/squad", label: "Squad", icon: Users },
  { href: "/club/market", label: "Market", icon: ShoppingBag },
  { href: "/club/team-hub", label: "Hub", icon: Trophy },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 pb-safe">
      <div className="mx-auto w-full max-w-[760px] px-2 pb-2">
        <div className="glass-panel flex h-14 items-stretch rounded-xl border border-border/70">
          {tabs.map((tab) => {
            let isActive = false;
            if (tab.href === "/home") {
              isActive = pathname === "/home";
            } else if (tab.href === "/play") {
              isActive =
                pathname.startsWith("/play") ||
                pathname.startsWith("/match") ||
                pathname.startsWith("/matchday");
            } else if (tab.href === "/club/squad") {
              isActive = pathname === "/club/squad" || pathname === "/club/tactics";
            } else if (tab.href === "/club/market") {
              isActive = pathname === "/club/market" || pathname === "/club/players";
            } else if (tab.href === "/club/team-hub") {
              isActive =
                pathname === "/club/team-hub" ||
                pathname === "/club" ||
                pathname === "/club/leaderboard";
            }

            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-150",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-text-dim hover:bg-surface-alt/55 hover:text-text-mid"
                )}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em]">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
