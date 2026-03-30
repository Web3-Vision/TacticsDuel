"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMatchStore } from "@/lib/stores/match-store";
import MatchViewer from "@/components/match/MatchViewer";
import type { MatchEvent } from "@/lib/types";

export default function MatchReplayPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { loadReplay } = useMatchStore();

  useEffect(() => {
    async function fetchMatch() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: match, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (fetchError || !match) {
        setError("Match not found");
        setLoading(false);
        return;
      }

      // Verify user is a participant
      if (match.home_user_id !== user.id && match.away_user_id !== user.id) {
        setError("You are not a participant in this match");
        setLoading(false);
        return;
      }

      if (match.status !== "completed" || !match.events) {
        setError("Match not yet completed");
        setLoading(false);
        return;
      }

      const events = match.events as MatchEvent[];
      const homeClub = match.home_club_name ?? "Home";
      const awayClub = match.away_club_name ?? "Away";

      loadReplay(events, null, homeClub, awayClub);
      setLoading(false);
    }

    fetchMatch();
  }, [matchId, router, loadReplay]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-mono text-sm text-text-dim">Loading match...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <p className="font-mono text-sm text-text-mid">{error}</p>
        <button
          onClick={() => router.push("/history")}
          className="h-10 px-4 border border-border text-text-mid font-mono text-xs uppercase tracking-wide rounded-[4px] hover:border-border-light transition-colors duration-100"
        >
          Back to History
        </button>
      </div>
    );
  }

  return <MatchViewer />;
}
