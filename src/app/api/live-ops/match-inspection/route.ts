import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 25), 100);
    const stalledAfterSeconds = Math.min(parsePositiveInt(searchParams.get("stalledAfterSeconds"), 180), 3600);
    const serviceClient = await createServiceClient();

    const { data: sessions, error: sessionsError } = await serviceClient
      .from("match_session_snapshots")
      .select("session_id, room_code, match_id, status, phase, turn_number, active_side, version, created_by_user_id, created_at, updated_at, last_event_type, last_event_at")
      .in("status", ["waiting", "active"])
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (sessionsError) {
      throw new Error(sessionsError.message);
    }

    const sessionIds = (sessions ?? []).map((session) => session.session_id);
    const [participantsResult, rejectedTurnsResult] = await Promise.all([
      sessionIds.length > 0
        ? serviceClient
          .from("match_session_participants")
          .select("session_id, user_id, side, connected, joined_at, last_seen_at")
          .in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null }),
      serviceClient
        .from("match_session_events")
        .select("id, session_id, match_id, event_type, event_payload, turn_number, version, created_at")
        .eq("event_type", "turn_rejected")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (participantsResult.error) {
      throw new Error(participantsResult.error.message);
    }
    if (rejectedTurnsResult.error) {
      throw new Error(rejectedTurnsResult.error.message);
    }

    const nowMs = Date.now();
    const participantsBySessionId = new Map<string, Array<Record<string, unknown>>>();
    for (const participant of participantsResult.data ?? []) {
      const list = participantsBySessionId.get(participant.session_id) ?? [];
      list.push(participant);
      participantsBySessionId.set(participant.session_id, list);
    }

    const activeSessions = (sessions ?? []).map((session) => {
      const participants = participantsBySessionId.get(session.session_id) ?? [];
      const stalledForSeconds = Math.max(0, Math.round((nowMs - Date.parse(session.updated_at)) / 1000));
      return {
        sessionId: session.session_id,
        roomCode: session.room_code,
        matchId: session.match_id,
        status: session.status,
        phase: session.phase,
        turnNumber: session.turn_number,
        activeSide: session.active_side,
        version: session.version,
        updatedAt: session.updated_at,
        lastEventType: session.last_event_type,
        lastEventAt: session.last_event_at,
        stalled: stalledForSeconds >= stalledAfterSeconds,
        stalledForSeconds,
        participants,
      };
    });

    const disconnectedParticipants = activeSessions.flatMap((session) =>
      session.participants
        .filter((participant) => participant.connected === false)
        .map((participant) => ({
          sessionId: session.sessionId,
          roomCode: session.roomCode,
          matchId: session.matchId,
          userId: participant.user_id,
          side: participant.side,
          lastSeenAt: participant.last_seen_at,
          disconnectedForSeconds: Math.max(0, Math.round((nowMs - Date.parse(String(participant.last_seen_at))) / 1000)),
          version: session.version,
        })),
    );

    return NextResponse.json({
      generatedAt: new Date(nowMs).toISOString(),
      stalledAfterSeconds,
      activeSessions,
      disconnectedParticipants,
      stalledVersions: activeSessions
        .filter((session) => session.stalled)
        .map((session) => ({
          sessionId: session.sessionId,
          matchId: session.matchId,
          version: session.version,
          stalledForSeconds: session.stalledForSeconds,
          updatedAt: session.updatedAt,
          lastEventType: session.lastEventType,
        })),
      rejectedTurns: (rejectedTurnsResult.data ?? []).map((event) => ({
        id: event.id,
        sessionId: event.session_id,
        matchId: event.match_id,
        turnNumber: event.turn_number,
        version: event.version,
        createdAt: event.created_at,
        payload: event.event_payload,
      })),
    });
  } catch (error) {
    console.error("Live ops match inspection GET error", error);
    return NextResponse.json({ error: "Failed to inspect match sessions" }, { status: 500 });
  }
}
