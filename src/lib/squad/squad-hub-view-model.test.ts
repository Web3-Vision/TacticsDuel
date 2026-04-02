import { describe, expect, it } from "vitest";
import { getPlayerById } from "../data/players";
import { buildSquadHubViewModel } from "./squad-hub-view-model";

describe("squad hub view-model", () => {
  it("groups starters by tactical line and computes readiness", () => {
    const model = buildSquadHubViewModel({
      starters: [
        getPlayerById("courtois_01") ?? null,
        getPlayerById("vandijk_01") ?? null,
        getPlayerById("debruyne_01") ?? null,
        getPlayerById("mbappe_01") ?? null,
      ],
      bench: [getPlayerById("rodri_01") ?? null],
      captainId: "debruyne_01",
      listedPlayerIds: ["mbappe_01", "rodri_01"],
    });

    expect(model.lines.find((line) => line.key === "goalkeepers")?.players).toHaveLength(1);
    expect(model.lines.find((line) => line.key === "defenders")?.players).toHaveLength(1);
    expect(model.lines.find((line) => line.key === "midfielders")?.players).toHaveLength(1);
    expect(model.lines.find((line) => line.key === "attackers")?.players).toHaveLength(1);
    expect(model.startersFilled).toBe(4);
    expect(model.benchFilled).toBe(1);
    expect(model.listedCount).toBe(2);
    expect(model.captain?.id).toBe("debruyne_01");
    expect(model.isReady).toBe(false);
    expect(model.chemistrySummary.score).toBeGreaterThan(0);
    expect(model.chemistryByPlayerId["debruyne_01"]?.score).toBeGreaterThanOrEqual(0);
    expect(model.lines.every((line) => typeof line.chemistryAvg === "number")).toBe(true);
  });

  it("marks lineup as ready when all starter slots are filled", () => {
    const starterIds = [
      "courtois_01",
      "cancelo_01",
      "vandijk_01",
      "dias_01",
      "davies_01",
      "debruyne_01",
      "modric_01",
      "pedri_01",
      "salah_01",
      "mbappe_01",
      "vinicius_01",
    ];

    const model = buildSquadHubViewModel({
      starters: starterIds.map((id) => getPlayerById(id) ?? null),
      bench: Array(10).fill(null),
      captainId: null,
    });

    expect(model.isReady).toBe(true);
    expect(model.startersFilled).toBe(11);
    expect(model.chemistrySummary.maxScore).toBe(110);
  });
});
