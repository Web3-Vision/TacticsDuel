import type { Player, Tactics } from "../types";

export interface TeamRatings {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
  overall: number;
}

export interface ModifiedRatings extends TeamRatings {
  eventRate: number; // modifier on how many events happen
  conversionRate: number; // modifier on chance → goal
  counterAttack: number; // bonus for counter opportunities
  compactness: number; // defensive shape bonus
}

function avg(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function calculateTeamRatings(squad: Player[]): TeamRatings {
  const gks = squad.filter((p) => p.position === "GK");
  const defenders = squad.filter((p) =>
    ["CB", "LB", "RB"].includes(p.position)
  );
  const midfielders = squad.filter((p) => p.position === "CM");
  const attackers = squad.filter((p) =>
    ["LW", "RW", "ST"].includes(p.position)
  );

  const attack = avg(
    attackers.map(
      (p) => p.shooting * 0.35 + p.pace * 0.25 + p.dribbling * 0.25 + p.passing * 0.15
    )
  );

  const midfield = avg(
    midfielders.map(
      (p) => p.passing * 0.35 + p.dribbling * 0.25 + p.physical * 0.2 + p.defending * 0.2
    )
  );

  const defense = avg(
    defenders.map(
      (p) => p.defending * 0.4 + p.physical * 0.25 + p.pace * 0.2 + p.passing * 0.15
    )
  );

  const goalkeeping = gks.length > 0
    ? avg(gks.map((p) => p.goalkeeping * 0.7 + p.physical * 0.15 + p.pace * 0.15))
    : 50;

  const overall = attack * 0.3 + midfield * 0.3 + defense * 0.25 + goalkeeping * 0.15;

  return { attack, midfield, defense, goalkeeping, overall };
}

export function applyTacticalModifiers(
  ratings: TeamRatings,
  tactics: Tactics
): ModifiedRatings {
  let atkMod = 1;
  let defMod = 1;
  let eventRate = 1;
  let conversionRate = 1;
  let counterAttack = 0;
  let compactness = 0;

  // Mentality
  switch (tactics.mentality) {
    case "Defensive":
      atkMod *= 0.85;
      defMod *= 1.12;
      eventRate *= 0.90;
      break;
    case "Cautious":
      atkMod *= 0.92;
      defMod *= 1.06;
      eventRate *= 0.95;
      break;
    case "Balanced":
      break;
    case "Attacking":
      atkMod *= 1.10;
      defMod *= 0.92;
      eventRate *= 1.08;
      break;
    case "All-out Attack":
      atkMod *= 1.18;
      defMod *= 0.85;
      eventRate *= 1.15;
      break;
  }

  // Tempo
  switch (tactics.tempo) {
    case "Slow":
      eventRate *= 0.80;
      conversionRate *= 1.15;
      compactness += 10;
      break;
    case "Normal":
      break;
    case "Fast":
      eventRate *= 1.20;
      conversionRate *= 0.90;
      compactness -= 8;
      break;
  }

  // Pressing
  switch (tactics.pressing) {
    case "Low":
      counterAttack += 15;
      compactness += 10;
      eventRate *= 0.90;
      break;
    case "Medium":
      break;
    case "High":
      atkMod *= 1.05;
      defMod *= 0.95;
      eventRate *= 1.10;
      counterAttack -= 5;
      compactness -= 10;
      break;
  }

  // Width
  switch (tactics.width) {
    case "Narrow":
      conversionRate *= 1.05;
      compactness += 5;
      break;
    case "Normal":
      break;
    case "Wide":
      atkMod *= 1.03;
      conversionRate *= 0.97;
      compactness -= 5;
      break;
  }

  return {
    attack: ratings.attack * atkMod,
    midfield: ratings.midfield,
    defense: ratings.defense * defMod,
    goalkeeping: ratings.goalkeeping,
    overall: ratings.overall,
    eventRate,
    conversionRate,
    counterAttack,
    compactness,
  };
}
