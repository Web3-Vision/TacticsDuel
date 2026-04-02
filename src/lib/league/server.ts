import { decodeOffsetCursor, encodeOffsetCursor } from "@/lib/live-ops/contracts";

type SupabaseLike = {
  from: (table: string) => any;
};

export interface LeagueLadderRow {
  id: string;
  username: string;
  club_name: string;
  division: number;
  division_points: number;
  elo_rating: number;
  wins: number;
  draws: number;
  losses: number;
  updated_at?: string;
}

export interface LeagueLadderResult {
  rows: LeagueLadderRow[];
  nextCursor: string | null;
}

export async function fetchLeagueLadder(
  supabase: SupabaseLike,
  input: {
    division?: number | null;
    limit?: number;
    cursor?: string | null;
  },
): Promise<LeagueLadderResult> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 25));
  const offset = decodeOffsetCursor(input.cursor ?? null);

  let query: any = supabase
    .from("profiles")
    .select("id, username, club_name, division, division_points, elo_rating, wins, draws, losses, updated_at")
    .order("elo_rating", { ascending: false })
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true });

  if (typeof input.division === "number") {
    query = query.eq("division", input.division);
  }

  const { data, error } = await query.range(offset, offset + limit);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as LeagueLadderRow[];
  const hasMore = rows.length > limit;

  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
  };
}
