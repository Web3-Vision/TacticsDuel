import { describe, expect, it } from "vitest";
import { buildNarrativeContent } from "./content-system";

describe("buildNarrativeContent", () => {
  it("creates inbox, news, and recap items from completed matches", () => {
    const output = buildNarrativeContent({
      userId: "me",
      clubNameByUserId: { rival: "Rival FC" },
      matches: [
        {
          id: "match-1",
          home_user_id: "me",
          away_user_id: "rival",
          home_score: 2,
          away_score: 1,
          match_type: "ranked",
          completed_at: "2026-03-31T10:00:00.000Z",
          home_elo_change: 12,
          away_elo_change: -12,
        },
      ],
    });

    expect(output.inbox).toHaveLength(1);
    expect(output.news).toHaveLength(1);
    expect(output.roundRecap).toHaveLength(1);
    expect(output.inbox[0].body).toContain("ELO +12");
    expect(output.roundRecap[0].title).toContain("Rival FC");
  });

  it("returns placeholder content when there are no completed matches", () => {
    const output = buildNarrativeContent({
      userId: "me",
      matches: [],
    });

    expect(output.inbox[0].title).toContain("Inbox clear");
    expect(output.news[0].title).toContain("Wire standby");
    expect(output.roundRecap[0].title).toContain("No round recap yet");
  });
});
