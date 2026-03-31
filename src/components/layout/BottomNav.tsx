"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, PlayCircle, Users, ShoppingBag, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "Home", icon: LayoutGrid },
  { href: "/play", label: "Play", icon: PlayCircle },
  { href: "/club/squad", label: "Squad", icon: Users },
  { href: "/club/players", label: "Market", icon: ShoppingBag },
  { href: "/club", label: "Club", icon: Trophy },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-surface border-t border-border pb-safe">
      <div className="flex items-stretch h-full max-w-[640px] mx-auto">
        {tabs.map((tab) => {
          let isActive = false;
          if (tab.href === "/home") {
            isActive = pathname === "/home";
          } else if (tab.href === "/play") {
            isActive = pathname.startsWith("/play") || pathname.startsWith("/match");
          } else if (tab.href === "/club/squad") {
            isActive = pathname === "/club/squad" || pathname === "/club/tactics";
          } else if (tab.href === "/club/players") {
            isActive = pathname === "/club/players";
          } else if (tab.href === "/club") {
            isActive = pathname === "/club" || pathname === "/club/leaderboard";
          }

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px]",
                isActive
                  ? "text-accent border-t-2 border-accent -mt-px"
                  : "text-text-dim"
              )}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span className="font-mono text-[9px] uppercase tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
