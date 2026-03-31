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
}

export interface SquadHubViewModel {
  lines: SquadHubLine[];
  startersFilled: number;
  benchFilled: number;
  listedCount: number;
  captain: Player | null;
  isReady: boolean;
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

  const listedCount = [...starters, ...bench].reduce((total, player) => {
    return total + (listedSet.has(player.id) ? 1 : 0);
  }, 0);

  return {
    lines: [
      { key: "goalkeepers", label: "Goalkeepers", players: grouped.goalkeepers },
      { key: "defenders", label: "Defenders", players: grouped.defenders },
      { key: "midfielders", label: "Midfield", players: grouped.midfielders },
      { key: "attackers", label: "Attack", players: grouped.attackers },
    ],
    startersFilled: starters.length,
    benchFilled: bench.length,
    listedCount,
    captain: [...starters, ...bench].find((player) => player.id === input.captainId) ?? null,
    isReady: starters.length === 11,
  };
}
