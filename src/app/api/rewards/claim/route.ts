import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/utils";

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
    const { rewardId } = body;

    // Get reward
    const { data: reward, error } = await supabase
      .from("season_rewards")
      .select("*")
      .eq("id", rewardId)
      .eq("user_id", user.id)
      .eq("claimed", false)
      .single();

    if (error || !reward) {
      return NextResponse.json(
        { error: "Reward not found or already claimed" },
        { status: 404 }
      );
    }

    const division = DIVISIONS.find((d) => d.id === reward.highest_division);
    const coins = division?.rewardCoins ?? 100;

    // Claim reward
    await supabase
      .from("season_rewards")
      .update({ claimed: true, coins_earned: coins })
      .eq("id", rewardId);

    // Add coins to profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ coins: profile.coins + coins })
        .eq("id", user.id);
    }

    return NextResponse.json({ claimed: true, coins });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
