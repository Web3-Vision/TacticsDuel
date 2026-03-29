import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { simulateMatch } from "@/lib/engine/match-engine";
import { calculateEloChange, calculateDivisionPoints } from "@/lib/engine/elo";
import type { Player, Tactics } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    // Get match record
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "accepted" && match.status !== "pending") {
      return NextResponse.json(
        { error: "Match already simulated" },
        { status: 400 }
      );
    }

    // Simulate
    const result = simulateMatch({
      homeSquad: match.home_squad as Player[],
      awaySquad: match.away_squad as Player[],
      homeTactics: match.home_tactics as Tactics,
      awayTactics: match.away_tactics as Tactics,
      matchType: match.match_type,
    });

    // Determine result for each player
    const homeResult =
      result.homeScore > result.awayScore
        ? "win"
        : result.homeScore < result.awayScore
          ? "loss"
          : ("draw" as const);
    const awayResult =
      homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : ("draw" as const);

    // Calculate ELO changes for ranked
    let homeEloChange = 0;
    let awayEloChange = 0;
    let homeDivPointsChange = 0;
    let awayDivPointsChange = 0;

    if (match.match_type === "ranked") {
      homeEloChange = calculateEloChange(
        match.home_elo_before ?? 1000,
        match.away_elo_before ?? 1000,
        homeResult
      );
      awayEloChange = calculateEloChange(
        match.away_elo_before ?? 1000,
        match.home_elo_before ?? 1000,
        awayResult
      );
      homeDivPointsChange = calculateDivisionPoints(
        homeResult,
        match.home_elo_before ?? 1000,
        match.away_elo_before ?? 1000,
        0
      );
      awayDivPointsChange = calculateDivisionPoints(
        awayResult,
        match.away_elo_before ?? 1000,
        match.home_elo_before ?? 1000,
        0
      );
    }

    // Update match record
    await supabase
      .from("matches")
      .update({
        status: "completed",
        home_score: result.homeScore,
        away_score: result.awayScore,
        home_possession: result.stats.homePossession,
        away_possession: result.stats.awayPossession,
        home_shots: result.stats.homeShots,
        away_shots: result.stats.awayShots,
        home_on_target: result.stats.homeOnTarget,
        away_on_target: result.stats.awayOnTarget,
        events: result.events,
        home_elo_change: homeEloChange,
        away_elo_change: awayEloChange,
        home_division_points_change: homeDivPointsChange,
        away_division_points_change: awayDivPointsChange,
        completed_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    // Update player profiles for ranked
    if (match.match_type === "ranked") {
      // Home player
      const { data: homeProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", match.home_user_id)
        .single();

      if (homeProfile) {
        const newStreak =
          homeResult === "win"
            ? homeProfile.current_streak + 1
            : homeResult === "loss"
              ? 0
              : homeProfile.current_streak;

        await supabase
          .from("profiles")
          .update({
            elo_rating: homeProfile.elo_rating + homeEloChange,
            division_points: homeProfile.division_points + homeDivPointsChange,
            wins: homeProfile.wins + (homeResult === "win" ? 1 : 0),
            draws: homeProfile.draws + (homeResult === "draw" ? 1 : 0),
            losses: homeProfile.losses + (homeResult === "loss" ? 1 : 0),
            current_streak: newStreak,
            best_streak: Math.max(homeProfile.best_streak, newStreak),
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.home_user_id);
      }

      // Away player
      if (match.away_user_id) {
        const { data: awayProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", match.away_user_id)
          .single();

        if (awayProfile) {
          const newStreak =
            awayResult === "win"
              ? awayProfile.current_streak + 1
              : awayResult === "loss"
                ? 0
                : awayProfile.current_streak;

          await supabase
            .from("profiles")
            .update({
              elo_rating: awayProfile.elo_rating + awayEloChange,
              division_points: awayProfile.division_points + awayDivPointsChange,
              wins: awayProfile.wins + (awayResult === "win" ? 1 : 0),
              draws: awayProfile.draws + (awayResult === "draw" ? 1 : 0),
              losses: awayProfile.losses + (awayResult === "loss" ? 1 : 0),
              current_streak: newStreak,
              best_streak: Math.max(awayProfile.best_streak, newStreak),
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.away_user_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        events: result.events,
        stats: result.stats,
        homeEloChange,
        awayEloChange,
        homeDivPointsChange,
        awayDivPointsChange,
      },
    });
  } catch (error) {
    console.error("Match simulation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
