import { countSavedStarters } from "../squad/persisted-squad";
import { RANKED_MIN_STARTERS } from "./competitive-flow";

export interface QueueClaimLease {
  claimId: string;
  opponentUserId: string;
  opponentElo: number;
}

export interface RankedMatchParticipantData {
  squadRow: { player_ids: unknown } | null;
  tactics: Record<string, unknown> | null;
}

export interface CreateRankedMatchInput {
  homeUserId: string;
  awayUserId: string;
  homeElo: number;
  awayElo: number;
  home: RankedMatchParticipantData;
  away: RankedMatchParticipantData;
}

export interface RankedMatchAllocationRepository {
  claimOpponent(input: { userId: string; elo: number; eloRange: number }): Promise<QueueClaimLease | null>;
  loadParticipant(userId: string): Promise<RankedMatchParticipantData | null>;
  createMatch(input: CreateRankedMatchInput): Promise<{ id: string } | null>;
  finalizeClaim(claimId: string, matchId: string): Promise<boolean>;
  releaseClaim(claimId: string, reason: string): Promise<void>;
}

function isRankedReady(participant: RankedMatchParticipantData | null): participant is RankedMatchParticipantData {
  return Boolean(participant?.tactics && countSavedStarters(participant.squadRow) >= RANKED_MIN_STARTERS);
}

export async function allocateRankedMatch(
  repository: RankedMatchAllocationRepository,
  input: { userId: string; elo: number; eloRange: number },
): Promise<{ id: string } | null> {
  const claim = await repository.claimOpponent(input);
  if (!claim) {
    return null;
  }

  const [home, away] = await Promise.all([
    repository.loadParticipant(input.userId),
    repository.loadParticipant(claim.opponentUserId),
  ]);

  if (!isRankedReady(home) || !isRankedReady(away)) {
    await repository.releaseClaim(claim.claimId, "participant_not_ready");
    return null;
  }

  const match = await repository.createMatch({
    homeUserId: input.userId,
    awayUserId: claim.opponentUserId,
    homeElo: input.elo,
    awayElo: claim.opponentElo,
    home,
    away,
  });

  if (!match) {
    await repository.releaseClaim(claim.claimId, "match_insert_failed");
    return null;
  }

  const finalized = await repository.finalizeClaim(claim.claimId, match.id);
  if (!finalized) {
    await repository.releaseClaim(claim.claimId, "claim_finalize_failed");
    return null;
  }

  return match;
}
