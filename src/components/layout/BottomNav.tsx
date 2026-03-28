"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Users, PlayCircle, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/squad", label: "Squad", icon: Users },
  { href: "/play", label: "Play", icon: PlayCircle },
  { href: "/divisions", label: "Ladder", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-surface border-t border-border pb-safe">
      <div className="flex items-stretch h-full max-w-[480px] mx-auto">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
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
              <Icon size={20} strokeWidth={1.5} />
              <span className="font-mono text-[10px] uppercase tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
