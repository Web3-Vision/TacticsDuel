import { NextResponse } from "next/server";
import { buildLiveOpsEventCards, getCadenceSnapshot, sortMissionRows, type FeedContractRow, type MissionContractRow } from "@/lib/live-ops/contracts";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const now = new Date();
    const cadence = getCadenceSnapshot(now);
    const [missionsResult, inboxResult, newsResult] = await Promise.all([
      user
        ? supabase
          .from("missions")
          .select("id, mission_type, mission_key, description, target, progress, reward_coins, expires_at, claimed, is_featured, recommended_mode, priority_weight, created_at")
          .eq("user_id", user.id)
          .eq("claimed", false)
          .gte("expires_at", now.toISOString())
        : Promise.resolve({ data: [] }),
      user
        ? supabase
          .from("inbox_messages")
          .select("id, title, body, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2)
        : Promise.resolve({ data: [] }),
      supabase
        .from("news_feed_items")
        .select("id, title, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const missions = sortMissionRows((missionsResult.data ?? []) as MissionContractRow[]);
    const cards = buildLiveOpsEventCards({
      now,
      cadence,
      missions,
      inbox: (inboxResult.data ?? []) as FeedContractRow[],
      news: (newsResult.data ?? []) as FeedContractRow[],
    });

    return NextResponse.json({
      cadence,
      events: cards,
    });
  } catch (error) {
    console.error("Live ops events GET error", error);
    return NextResponse.json({ error: "Failed to fetch live ops events" }, { status: 500 });
  }
}
