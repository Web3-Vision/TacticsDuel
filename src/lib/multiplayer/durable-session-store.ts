import type { MatchSession } from "./session-service";

export async function persistSessionSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  session: MatchSession,
  eventType: string,
  eventPayload: Record<string, unknown> = {},
) {
  const existingSnapshot = await supabase
    .from("match_session_snapshots")
    .select("version")
    .eq("session_id", session.id)
    .maybeSingle();

  const nextVersion = (existingSnapshot.data?.version ?? 0) + 1;
  const snapshotUpsert = await supabase
    .from("match_session_snapshots")
    .upsert({
      session_id: session.id,
      room_code: session.roomCode,
      match_id: session.matchId,
      status: session.status,
      phase: session.phase,
      turn_number: session.turnNumber,
      active_side: session.activeSide,
      version: nextVersion,
      created_by_user_id: session.createdByUserId,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      last_event_type: eventType,
      last_event_at: new Date().toISOString(),
    }, { onConflict: "session_id" });

  if (snapshotUpsert.error) {
    throw new Error(`Failed to upsert session snapshot: ${snapshotUpsert.error.message}`);
  }

  const deleteParticipants = await supabase
    .from("match_session_participants")
    .delete()
    .eq("session_id", session.id);

  if (deleteParticipants.error) {
    throw new Error(`Failed to refresh session participants: ${deleteParticipants.error.message}`);
  }

  if (session.participants.length > 0) {
    const participantInsert = await supabase
      .from("match_session_participants")
      .insert(
        session.participants.map((participant) => ({
          session_id: session.id,
          user_id: participant.userId,
          side: participant.side,
          connected: participant.connected,
          joined_at: participant.joinedAt,
          last_seen_at: participant.lastSeenAt,
        })),
      );

    if (participantInsert.error) {
      throw new Error(`Failed to persist session participants: ${participantInsert.error.message}`);
    }
  }

  const eventInsert = await supabase
    .from("match_session_events")
    .insert({
      session_id: session.id,
      match_id: session.matchId,
      event_type: eventType,
      event_payload: eventPayload,
      turn_number: session.turnNumber,
      version: nextVersion,
    });

  if (eventInsert.error) {
    throw new Error(`Failed to persist session event: ${eventInsert.error.message}`);
  }

  return nextVersion;
}
