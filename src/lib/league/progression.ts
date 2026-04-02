import type { Profile } from "../types";
import { DIVISIONS } from "../utils";

export type RankedMatchResult = "win" | "draw" | "loss";

type RankedProfileSnapshot = Pick<
  Profile,
  | "division"
  | "division_points"
  | "division_season"
  | "division_wins"
  | "division_draws"
  | "division_losses"
  | "division_matches_played"
  | "ranked_matches_in_cycle"
  | "squad_locked"
  | "transfers_remaining"
  | "wins"
  | "draws"
  | "losses"
  | "current_streak"
  | "best_streak"
>;

export interface SeasonRewardGrant {
  season: number;
  highestDivision: number;
  coinsEarned: number;
}

export interface RankedProgressionResult {
  patch: {
    division_points: number;
    division: number;
    wins: number;
    draws: number;
    losses: number;
    current_streak: number;
    best_streak: number;
    ranked_matches_in_cycle: number;
    squad_locked: boolean;
    transfers_remaining: number;
    division_wins: number;
    division_draws: number;
    division_losses: number;
    division_season: number;
    division_matches_played: number;
    updated_at: string;
  };
  seasonReward: SeasonRewardGrant | null;
}

export function computeRankedProgression(
  profile: RankedProfileSnapshot,
  result: RankedMatchResult,
  divisionPointsChange: number,
  nowIso: string,
): RankedProgressionResult {
  const newStreak =
    result === "win"
      ? profile.current_streak + 1
      : result === "loss"
        ? 0
        : profile.current_streak;

  const newDivPoints = Math.max(0, profile.division_points + divisionPointsChange);
  const newRankedInCycle = (profile.ranked_matches_in_cycle ?? 0) + 1;
  const newDivMatchesPlayed = (profile.division_matches_played ?? 0) + 1;
  const cycleComplete = newRankedInCycle >= 5;

  let newDivision = profile.division;
  let newDivisionPoints = newDivPoints;
  let newDivSeason = profile.division_season ?? 1;
  let newDivWins = (profile.division_wins ?? 0) + (result === "win" ? 1 : 0);
  let newDivDraws = (profile.division_draws ?? 0) + (result === "draw" ? 1 : 0);
  let newDivLosses = (profile.division_losses ?? 0) + (result === "loss" ? 1 : 0);
  let newDivMatchesPlayedFinal = newDivMatchesPlayed;
  let seasonReward: SeasonRewardGrant | null = null;

  if (newDivMatchesPlayed >= 10) {
    const divConfig = DIVISIONS.find((division) => division.id === profile.division) ?? null;
    if (divConfig?.pointsToPromote && newDivisionPoints >= divConfig.pointsToPromote) {
      newDivision = Math.max(1, profile.division - 1);
      seasonReward = {
        season: profile.division_season ?? 1,
        highestDivision: profile.division,
        coinsEarned: divConfig.rewardCoins,
      };
    } else if (newDivisionPoints <= 0 && profile.division < 10) {
      newDivision = profile.division + 1;
    }

    newDivisionPoints = 0;
    newDivSeason += 1;
    newDivWins = 0;
    newDivDraws = 0;
    newDivLosses = 0;
    newDivMatchesPlayedFinal = 0;
  }

  return {
    patch: {
      division_points: newDivisionPoints,
      division: newDivision,
      wins: profile.wins + (result === "win" ? 1 : 0),
      draws: profile.draws + (result === "draw" ? 1 : 0),
      losses: profile.losses + (result === "loss" ? 1 : 0),
      current_streak: newStreak,
      best_streak: Math.max(profile.best_streak, newStreak),
      ranked_matches_in_cycle: cycleComplete ? 0 : newRankedInCycle,
      squad_locked: cycleComplete ? false : profile.squad_locked,
      transfers_remaining: cycleComplete ? 2 : (profile.transfers_remaining ?? 0),
      division_wins: newDivWins,
      division_draws: newDivDraws,
      division_losses: newDivLosses,
      division_season: newDivSeason,
      division_matches_played: newDivMatchesPlayedFinal,
      updated_at: nowIso,
    },
    seasonReward,
  };
}
