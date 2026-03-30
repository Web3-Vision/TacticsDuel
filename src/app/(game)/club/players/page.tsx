"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PlayerMarket from "@/components/squad/PlayerMarket";
import PlayerDetail from "@/components/squad/PlayerDetail";
import type { Player } from "@/lib/types";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    import("@/lib/data/players").then((mod) => {
      setPlayers(mod.PLAYERS);
      setLoaded(true);
    });
  }, []);

  function handleSelectPlayer(player: Player) {
    setDetailPlayer(player);
    setShowDetail(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <span className="font-mono text-xs text-text-dim uppercase tracking-wide">
          {loaded ? `${players.length} Players` : "Loading..."}
        </span>
        <Link
          href="/club/squad"
          className="font-mono text-xs text-accent hover:underline"
        >
          Go to Squad
        </Link>
      </div>

      <div className="flex-1 min-h-0">
        {loaded ? (
          <PlayerMarket
            players={players}
            onSelectPlayer={handleSelectPlayer}
          />
        ) : (
          <div className="p-4">
            <div className="h-3 bg-border rounded-sm w-32 mb-2" />
            <div className="h-3 bg-border rounded-sm w-48 mb-2" />
            <div className="h-3 bg-border rounded-sm w-40" />
          </div>
        )}
      </div>

      {/* Player detail - view only (no add/remove) */}
      <PlayerDetail
        player={detailPlayer}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setDetailPlayer(null);
        }}
      />
    </div>
  );
}
