"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { Player, Position } from "@/lib/types";
import { useSquadStore } from "@/lib/stores/squad-store";
import { cn } from "@/lib/utils";
import PlayerCard from "./PlayerCard";

const POSITIONS: (Position | "ALL")[] = [
  "ALL", "GK", "CB", "LB", "RB", "CM", "LW", "RW", "ST",
];

interface PlayerMarketProps {
  players: Player[];
  onSelectPlayer: (player: Player) => void;
  filterPosition?: Position | null;
}

export default function PlayerMarket({
  players,
  onSelectPlayer,
  filterPosition,
}: PlayerMarketProps) {
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "ALL">(
    filterPosition ?? "ALL"
  );
  const isPlayerInSquad = useSquadStore((s) => s.isPlayerInSquad);
  const canAfford = useSquadStore((s) => s.canAfford);

  const filtered = useMemo(() => {
    let list = players;
    if (posFilter !== "ALL") {
      list = list.filter((p) => p.position === posFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          p.club.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.overall - a.overall);
  }, [players, posFilter, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Position filter pills */}
      <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPosFilter(pos)}
            className={cn(
              "shrink-0 h-8 px-2.5 rounded-[3px] font-mono text-[11px] uppercase tracking-wide border transition-colors duration-100",
              posFilter === pos
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-dim hover:border-border-light"
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full h-9 bg-surface-alt border border-border rounded-[4px] pl-8 pr-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
          />
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-text-dim text-sm text-center py-8">
            No players found.
          </p>
        ) : (
          filtered.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onSelect={onSelectPlayer}
              disabled={isPlayerInSquad(player.id) || !canAfford(player)}
              inSquad={isPlayerInSquad(player.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
