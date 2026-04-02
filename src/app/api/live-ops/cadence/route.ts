import { NextResponse } from "next/server";
import { getCadenceSnapshot } from "@/lib/live-ops/contracts";

export async function GET() {
  return NextResponse.json({
    cadence: getCadenceSnapshot(),
  });
}
