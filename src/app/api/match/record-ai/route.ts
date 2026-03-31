import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistNarrativeArtifacts } from "@/lib/engine/narrative-pipeline";
import type { MatchEvent, MatchStats } from "@/lib/types";

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
    const { homeScore, awayScore, stats, events } = body as {
      homeScore?: number;
      awayScore?: number;
      stats?: MatchStats;
      events?: MatchEvent[];
    };

    if (homeScore === undefined || awayScore === undefined) {
      return NextResponse.json({ error: "Missing scores" }, { status: 400 });
    }

    // Insert match record
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        home_user_id: user.id,
        away_user_id: null,
        match_type: "ai",
        status: "completed",
        home_score: homeScore,
        away_score: awayScore,
        home_possession: stats?.homePossession ?? null,
        away_possession: stats?.awayPossession ?? null,
        home_shots: stats?.homeShots ?? null,
        away_shots: stats?.awayShots ?? null,
        home_on_target: stats?.homeOnTarget ?? null,
        away_on_target: stats?.awayOnTarget ?? null,
        events: events ?? [],
        home_squad: [],
        away_squad: [],
        home_tactics: {},
        away_tactics: {},
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    if (match?.id) {
      await persistNarrativeArtifacts(supabase, {
        matchId: match.id,
        matchType: "ai",
        homeUserId: user.id,
        awayUserId: null,
        homeScore,
        awayScore,
        stats: stats ?? {
          homePossession: 50,
          awayPossession: 50,
          homeShots: 0,
          awayShots: 0,
          homeOnTarget: 0,
          awayOnTarget: 0,
          homeCorners: 0,
          awayCorners: 0,
          homeFouls: 0,
          awayFouls: 0,
          homeYellowCards: 0,
          awayYellowCards: 0,
          homeRedCards: 0,
          awayRedCards: 0,
          homePassAccuracy: 0,
          awayPassAccuracy: 0,
        },
        events: events ?? [],
      });
    }

    // Update profile W/D/L and award coins
    const { data: profile } = await supabase
      .from("profiles")
      .select("wins, draws, losses, current_streak, best_streak, coins")
      .eq("id", user.id)
      .single();

    let coinsAwarded = 0;

    if (profile) {
      const result =
        homeScore > awayScore ? "win" : homeScore < awayScore ? "loss" : "draw";
      const newStreak =
        result === "win"
          ? profile.current_streak + 1
          : result === "loss"
            ? 0
            : profile.current_streak;

      // Coin rewards: base + goal bonus
      const baseCoins = result === "win" ? 300 : result === "draw" ? 150 : 50;
      const goalBonus = homeScore * 50;
      coinsAwarded = baseCoins + goalBonus;

      await supabase
        .from("profiles")
        .update({
          wins: profile.wins + (result === "win" ? 1 : 0),
          draws: profile.draws + (result === "draw" ? 1 : 0),
          losses: profile.losses + (result === "loss" ? 1 : 0),
          current_streak: newStreak,
          best_streak: Math.max(profile.best_streak, newStreak),
          coins: profile.coins + coinsAwarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true, matchId: match?.id, coinsAwarded });
  } catch (error) {
    console.error("Record AI match error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
