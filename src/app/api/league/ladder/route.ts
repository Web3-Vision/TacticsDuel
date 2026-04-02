import { NextResponse } from "next/server";
import { fetchLeagueLadder } from "@/lib/league/server";
import { createClient } from "@/lib/supabase/server";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const division = url.searchParams.get("division");
    const parsedDivision = division == null ? null : parsePositiveInt(division, 0);
    const normalizedDivision = parsedDivision != null && parsedDivision > 0 ? parsedDivision : null;
    const limit = parsePositiveInt(url.searchParams.get("limit"), 25);
    const cursor = url.searchParams.get("cursor");

    const supabase = await createClient();
    const ladder = await fetchLeagueLadder(supabase, {
      division: normalizedDivision,
      limit,
      cursor,
    });

    return NextResponse.json({
      division: normalizedDivision,
      rows: ladder.rows,
      nextCursor: ladder.nextCursor,
    });
  } catch (error) {
    console.error("League ladder GET error", error);
    return NextResponse.json({ error: "Failed to fetch league ladder" }, { status: 500 });
  }
}
