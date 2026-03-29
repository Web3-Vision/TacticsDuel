import type { Player, Tactics, Mentality, Tempo, Pressing, Width } from "../types";
import { SALARY_CAP } from "../utils";

export function generateAISquad(
  allPlayers: Player[],
  formationPositions: string[]
): Player[] {
  const squad: Player[] = [];
  const budget = SALARY_CAP;
  let spent = 0;

  // Sort by overall descending with some randomness
  const shuffled = [...allPlayers].sort(
    (a, b) => b.overall - a.overall + (Math.random() - 0.5) * 8
  );

  for (const pos of formationPositions) {
    const remaining = budget - spent;
    const slotsLeft = formationPositions.length - squad.length;
    const avgBudget = remaining / slotsLeft;

    // Find best player for this position within budget
    const candidate = shuffled.find(
      (p) =>
        p.position === pos &&
        !squad.some((s) => s.id === p.id) &&
        p.marketValue <= remaining &&
        // Don't blow entire budget on one player early
        (slotsLeft <= 2 || p.marketValue <= avgBudget * 2.5)
    );

    if (candidate) {
      squad.push(candidate);
      spent += candidate.marketValue;
    } else {
      // Fallback: cheapest player for position
      const fallback = shuffled
        .filter(
          (p) =>
            p.position === pos &&
            !squad.some((s) => s.id === p.id) &&
            p.marketValue <= remaining
        )
        .sort((a, b) => a.marketValue - b.marketValue)[0];

      if (fallback) {
        squad.push(fallback);
        spent += fallback.marketValue;
      }
    }
  }

  return squad;
}

export function generateAITactics(): Tactics {
  const mentalities: Mentality[] = [
    "Defensive",
    "Cautious",
    "Balanced",
    "Attacking",
    "Balanced",
  ];
  const tempos: Tempo[] = ["Slow", "Normal", "Fast", "Normal"];
  const pressings: Pressing[] = ["Low", "Medium", "High", "Medium"];
  const widths: Width[] = ["Narrow", "Normal", "Wide", "Normal"];

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    formation: "4-3-3",
    mentality: pick(mentalities),
    tempo: pick(tempos),
    pressing: pick(pressings),
    width: pick(widths),
    htIfLosingMentality: "Attacking",
    htIfWinningMentality: "Defensive",
  };
}
