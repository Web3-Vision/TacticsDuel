import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickDailyMissions, pickWeeklyMissions } from "@/lib/engine/missions";
import { getMissionInsertMetadata } from "@/lib/live-ops/contracts";

// GET: Fetch active missions, generate if needed
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get existing active missions
    const { data: missions } = await supabase
      .from("missions")
      .select("*")
      .eq("user_id", user.id)
      .eq("claimed", false)
      .order("created_at", { ascending: false });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)

    // Check if we have daily missions for today
    const dailyMissions = (missions ?? []).filter(
      (m) => m.mission_type === "daily" && new Date(m.created_at) >= todayStart
    );

    // Check if we have weekly missions for this week
    const weeklyMissions = (missions ?? []).filter(
      (m) => m.mission_type === "weekly" && new Date(m.created_at) >= weekStart
    );

    // Generate daily missions if needed
    if (dailyMissions.length === 0) {
      const newDailies = pickDailyMissions(3);
      const dailyExpiry = new Date(todayStart);
      dailyExpiry.setDate(dailyExpiry.getDate() + 1);

      for (const [index, m] of newDailies.entries()) {
        const metadata = getMissionInsertMetadata("daily", m.key, index);
        await supabase.from("missions").insert({
          user_id: user.id,
          mission_type: "daily",
          mission_key: m.key,
          description: m.description,
          target: m.target,
          progress: 0,
          reward_coins: m.rewardCoins,
          expires_at: dailyExpiry.toISOString(),
          ...metadata,
        });
      }
    }

    // Generate weekly missions if needed
    if (weeklyMissions.length === 0) {
      const newWeeklies = pickWeeklyMissions(2);
      const weeklyExpiry = new Date(weekStart);
      weeklyExpiry.setDate(weeklyExpiry.getDate() + 7);

      for (const [index, m] of newWeeklies.entries()) {
        const metadata = getMissionInsertMetadata("weekly", m.key, index);
        await supabase.from("missions").insert({
          user_id: user.id,
          mission_type: "weekly",
          mission_key: m.key,
          description: m.description,
          target: m.target,
          progress: 0,
          reward_coins: m.rewardCoins,
          expires_at: weeklyExpiry.toISOString(),
          ...metadata,
        });
      }
    }

    // Re-fetch all active missions
    const { data: allMissions } = await supabase
      .from("missions")
      .select("*")
      .eq("user_id", user.id)
      .eq("claimed", false)
      .gte("expires_at", now.toISOString())
      .order("is_featured", { ascending: false })
      .order("priority_weight", { ascending: false })
      .order("mission_type", { ascending: true })
      .order("expires_at", { ascending: true })
      .order("created_at", { ascending: false });

    return NextResponse.json({ missions: allMissions ?? [] });
  } catch (error) {
    console.error("Missions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Claim a completed mission
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { missionId } = await request.json();

    const { data: mission } = await supabase
      .from("missions")
      .select("*")
      .eq("id", missionId)
      .eq("user_id", user.id)
      .single();

    if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    if (mission.claimed) return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    if (mission.progress < mission.target) return NextResponse.json({ error: "Not completed" }, { status: 400 });

    // Claim the mission
    await supabase.from("missions").update({ claimed: true }).eq("id", missionId);

    // Award coins
    const { data: profile } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ coins: (profile.coins ?? 0) + mission.reward_coins })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true, coinsAwarded: mission.reward_coins });
  } catch (error) {
    console.error("Claim mission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
