import { describe, expect, it } from "vitest";
import { allocateRankedMatch, type CreateRankedMatchInput, type QueueClaimLease, type RankedMatchAllocationRepository, type RankedMatchParticipantData } from "./queue-allocation";

function buildParticipantData(seed: string): RankedMatchParticipantData {
  return {
    squadRow: {
      player_ids: Array.from({ length: 11 }, (_, index) => `${seed}-${index + 1}`),
    },
    tactics: {
      formation: "4-3-3",
      mentality: "Balanced",
      tempo: "Normal",
      pressing: "Medium",
      width: "Normal",
      htIfLosingMentality: "Attacking",
      htIfWinningMentality: "Defensive",
    },
  };
}

class FakeRankedMatchRepository implements RankedMatchAllocationRepository {
  readonly participants = new Map<string, RankedMatchParticipantData>();
  readonly desiredOpponentByUserId = new Map<string, QueueClaimLease>();
  readonly createdMatches: CreateRankedMatchInput[] = [];
  readonly finalizedClaimIds: string[] = [];
  readonly releasedClaims: Array<{ claimId: string; reason: string }> = [];
  private readonly activeOpponentClaims = new Set<string>();

  async claimOpponent(input: { userId: string }): Promise<QueueClaimLease | null> {
    const desired = this.desiredOpponentByUserId.get(input.userId) ?? null;
    if (!desired) {
      return null;
    }

    await Promise.resolve();
    if (this.activeOpponentClaims.has(desired.opponentUserId)) {
      return null;
    }

    this.activeOpponentClaims.add(desired.opponentUserId);
    return desired;
  }

  async loadParticipant(userId: string): Promise<RankedMatchParticipantData | null> {
    return this.participants.get(userId) ?? null;
  }

  async createMatch(input: CreateRankedMatchInput): Promise<{ id: string } | null> {
    this.createdMatches.push(input);
    return { id: `match-${this.createdMatches.length}` };
  }

  async finalizeClaim(claimId: string): Promise<boolean> {
    this.finalizedClaimIds.push(claimId);
    return true;
  }

  async releaseClaim(claimId: string, reason: string): Promise<void> {
    this.releasedClaims.push({ claimId, reason });
  }
}

describe("ranked queue allocation", () => {
  it("only allocates one match when concurrent pollers race on the same opponent", async () => {
    const repository = new FakeRankedMatchRepository();
    repository.participants.set("user-a", buildParticipantData("home-a"));
    repository.participants.set("user-b", buildParticipantData("home-b"));
    repository.participants.set("shared-opponent", buildParticipantData("away"));

    repository.desiredOpponentByUserId.set("user-a", {
      claimId: "claim-a",
      opponentUserId: "shared-opponent",
      opponentElo: 1010,
    });
    repository.desiredOpponentByUserId.set("user-b", {
      claimId: "claim-b",
      opponentUserId: "shared-opponent",
      opponentElo: 1010,
    });

    const [first, second] = await Promise.all([
      allocateRankedMatch(repository, { userId: "user-a", elo: 1000, eloRange: 150 }),
      allocateRankedMatch(repository, { userId: "user-b", elo: 995, eloRange: 150 }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(repository.createdMatches).toHaveLength(1);
    expect(repository.finalizedClaimIds).toHaveLength(1);
    expect(repository.releasedClaims).toHaveLength(0);
  });

  it("releases the claim when a claimed participant is no longer ranked-ready", async () => {
    const repository = new FakeRankedMatchRepository();
    repository.participants.set("user-a", buildParticipantData("home-a"));
    repository.participants.set("shared-opponent", {
      squadRow: { player_ids: ["one", "two"] },
      tactics: null,
    });
    repository.desiredOpponentByUserId.set("user-a", {
      claimId: "claim-a",
      opponentUserId: "shared-opponent",
      opponentElo: 1002,
    });

    const result = await allocateRankedMatch(repository, { userId: "user-a", elo: 1000, eloRange: 150 });

    expect(result).toBeNull();
    expect(repository.createdMatches).toHaveLength(0);
    expect(repository.releasedClaims).toEqual([{ claimId: "claim-a", reason: "participant_not_ready" }]);
  });
});
