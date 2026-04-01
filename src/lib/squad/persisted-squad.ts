export const STARTER_SLOT_COUNT = 11;

export interface PersistedSquadRow {
  user_id: string;
  player_ids: unknown;
  bench_ids?: unknown;
  [key: string]: unknown;
}

export function normalizePersistedSlotIds(raw: unknown, size: number): Array<string | null> {
  if (!Array.isArray(raw)) {
    return Array(size).fill(null);
  }

  const output: Array<string | null> = Array(size).fill(null);
  for (let i = 0; i < size; i += 1) {
    const value = raw[i];
    output[i] = typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  return output;
}

export function countSavedStarters(squad: Pick<PersistedSquadRow, "player_ids"> | null | undefined): number {
  if (!squad) {
    return 0;
  }

  return normalizePersistedSlotIds(squad.player_ids, STARTER_SLOT_COUNT).filter((id) => id !== null).length;
}

export function resolveStarterIdsFromMatchSquad(rawSquad: unknown): string[] {
  if (!Array.isArray(rawSquad) || rawSquad.length === 0) {
    return [];
  }

  const first = rawSquad[0] as Record<string, unknown>;

  // New schema: match payload stores full squad row(s) with player_ids slots.
  if (first && Array.isArray(first.player_ids)) {
    const slotIds = normalizePersistedSlotIds(first.player_ids, STARTER_SLOT_COUNT);
    return slotIds.filter((id): id is string => id !== null);
  }

  // Legacy schema: rows with player_id.
  if (first && typeof first.player_id === "string") {
    return rawSquad
      .map((entry) => (entry as Record<string, unknown>).player_id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }

  // Already player ids.
  if (typeof first === "string") {
    return rawSquad.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }

  // Already player objects.
  if (typeof first.id === "string") {
    return rawSquad
      .map((entry) => (entry as Record<string, unknown>).id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }

  return [];
}
