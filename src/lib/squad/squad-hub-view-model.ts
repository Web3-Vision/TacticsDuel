import type { Player } from "@/lib/types";

export interface SquadHubViewModelInput {
  starters: (Player | null)[];
  bench: (Player | null)[];
  captainId: string | null;
  listedPlayerIds?: Iterable<string>;
}

export interface SquadHubLine {
  key: "goalkeepers" | "defenders" | "midfielders" | "attackers";
  label: string;
  players: Player[];
  chemistryAvg: number;
}

export interface SquadHubPlayerChemistry {
  score: number;
  clubLinks: number;
  nationLinks: number;
  lineLinks: number;
  label: "isolated" | "linked" | "strong" | "elite";
}

export interface SquadHubChemistrySummary {
  score: number;
  label: "cold" | "steady" | "hot";
  linkedPlayers: number;
  maxScore: number;
}

export interface SquadHubViewModel {
  lines: SquadHubLine[];
  startersFilled: number;
  benchFilled: number;
  listedCount: number;
  captain: Player | null;
  isReady: boolean;
  chemistryByPlayerId: Record<string, SquadHubPlayerChemistry>;
  chemistrySummary: SquadHubChemistrySummary;
}

function lineForPosition(position: Player["position"]): SquadHubLine["key"] {
  if (position === "GK") return "goalkeepers";
  if (position === "CB" || position === "LB" || position === "RB") return "defenders";
  if (position === "CM") return "midfielders";
  return "attackers";
}

export function buildSquadHubViewModel(input: SquadHubViewModelInput): SquadHubViewModel {
  const starters = input.starters.filter((player): player is Player => player !== null);
  const bench = input.bench.filter((player): player is Player => player !== null);
  const listedSet = new Set(input.listedPlayerIds ?? []);

  const grouped: Record<SquadHubLine["key"], Player[]> = {
    goalkeepers: [],
    defenders: [],
    midfielders: [],
    attackers: [],
  };

  for (const player of starters) {
    grouped[lineForPosition(player.position)].push(player);
  }

  const chemistryByPlayerId: Record<string, SquadHubPlayerChemistry> = {};
  let chemistryTotalScore = 0;
  let linkedPlayers = 0;

  for (const player of starters) {
    let clubLinks = 0;
    let nationLinks = 0;
    let lineLinks = 0;

    for (const teammate of starters) {
      if (teammate.id === player.id) continue;
      if (teammate.club === player.club) clubLinks += 1;
      if (teammate.nationality === player.nationality) nationLinks += 1;
      if (lineForPosition(teammate.position) === lineForPosition(player.position)) lineLinks += 1;
    }

    const score = Math.min(10, clubLinks * 2 + nationLinks + lineLinks);
    let label: SquadHubPlayerChemistry["label"] = "isolated";
    if (score >= 7) label = "elite";
    else if (score >= 4) label = "strong";
    else if (score >= 1) label = "linked";

    chemistryByPlayerId[player.id] = { score, clubLinks, nationLinks, lineLinks, label };
    chemistryTotalScore += score;
    if (score > 0) linkedPlayers += 1;
  }

  const chemistryMaxScore = starters.length * 10;
  const chemistryScore = chemistryMaxScore === 0 ? 0 : Math.round((chemistryTotalScore / chemistryMaxScore) * 100);
  let chemistryLabel: SquadHubChemistrySummary["label"] = "cold";
  if (chemistryScore >= 70) chemistryLabel = "hot";
  else if (chemistryScore >= 40) chemistryLabel = "steady";

  const listedCount = [...starters, ...bench].reduce((total, player) => {
    return total + (listedSet.has(player.id) ? 1 : 0);
  }, 0);

  return {
    lines: [
      {
        key: "goalkeepers",
        label: "Goalkeepers",
        players: grouped.goalkeepers,
        chemistryAvg: averageChemistry(grouped.goalkeepers, chemistryByPlayerId),
      },
      {
        key: "defenders",
        label: "Defenders",
        players: grouped.defenders,
        chemistryAvg: averageChemistry(grouped.defenders, chemistryByPlayerId),
      },
      {
        key: "midfielders",
        label: "Midfield",
        players: grouped.midfielders,
        chemistryAvg: averageChemistry(grouped.midfielders, chemistryByPlayerId),
      },
      {
        key: "attackers",
        label: "Attack",
        players: grouped.attackers,
        chemistryAvg: averageChemistry(grouped.attackers, chemistryByPlayerId),
      },
    ],
    startersFilled: starters.length,
    benchFilled: bench.length,
    listedCount,
    captain: [...starters, ...bench].find((player) => player.id === input.captainId) ?? null,
    isReady: starters.length === 11,
    chemistryByPlayerId,
    chemistrySummary: {
      score: chemistryScore,
      label: chemistryLabel,
      linkedPlayers,
      maxScore: chemistryMaxScore,
    },
  };
}

function averageChemistry(players: Player[], chemistryByPlayerId: Record<string, SquadHubPlayerChemistry>): number {
  if (players.length === 0) return 0;
  const total = players.reduce((sum, player) => sum + (chemistryByPlayerId[player.id]?.score ?? 0), 0);
  return Math.round(total / players.length);
}
