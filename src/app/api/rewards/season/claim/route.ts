import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ClaimRewardRpcRow = {
  reward_id: string | null;
  season: number | null;
  highest_division: number | null;
  coins_awarded: number | null;
  claimed: boolean | null;
  already_claimed: boolean | null;
  error_code: string | null;
  error_message: string | null;
};

function mapClaimErrorToStatus(errorCode: string): number {
  switch (errorCode) {
    case "unauthorized":
      return 401;
    case "reward_not_found":
      return 404;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rewardId = typeof body?.rewardId === "string" ? body.rewardId : "";
    if (!rewardId) {
      return NextResponse.json({ error: "Missing rewardId" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("claim_season_reward", {
      p_reward_id: rewardId,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to claim season reward" }, { status: 500 });
    }

    const row = (Array.isArray(data) && data[0] ? data[0] : null) as ClaimRewardRpcRow | null;
    if (!row) {
      return NextResponse.json({ error: "Failed to claim season reward" }, { status: 500 });
    }

    if (row.error_code) {
      return NextResponse.json(
        { error: row.error_message ?? "Failed to claim season reward" },
        { status: mapClaimErrorToStatus(row.error_code) },
      );
    }

    return NextResponse.json({
      reward: {
        id: row.reward_id,
        season: row.season,
        highestDivision: row.highest_division,
        coinsAwarded: row.coins_awarded,
        claimed: row.claimed,
        alreadyClaimed: row.already_claimed,
      },
    });
  } catch (error) {
    console.error("Season reward claim POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
