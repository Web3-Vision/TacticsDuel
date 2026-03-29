const K_FACTOR = 32;

export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: "win" | "draw" | "loss"
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  return Math.round(K_FACTOR * (actual - expected));
}

export function calculateDivisionPoints(
  result: "win" | "draw" | "loss",
  playerElo: number,
  opponentElo: number,
  currentStreak: number
): number {
  const eloDiff = opponentElo - playerElo;
  const streakMultiplier = currentStreak >= 3 ? 1.5 : 1;

  switch (result) {
    case "win": {
      const base = 10;
      const bonus = Math.max(0, Math.min(5, Math.round(eloDiff / 100)));
      return Math.round((base + bonus) * streakMultiplier);
    }
    case "draw":
      return 3;
    case "loss": {
      const base = -5;
      const reduction = Math.max(0, Math.min(3, Math.round(eloDiff / 150)));
      return base + reduction;
    }
  }
}
