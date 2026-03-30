export interface MissionDef {
  key: string;
  description: string;
  target: number;
  rewardCoins: number;
  type: "daily" | "weekly";
}

export const DAILY_MISSIONS: MissionDef[] = [
  { key: "play_ranked_3", description: "Play 3 ranked matches", target: 3, rewardCoins: 50, type: "daily" },
  { key: "win_match", description: "Win a match", target: 1, rewardCoins: 30, type: "daily" },
  { key: "clean_sheet", description: "Keep a clean sheet", target: 1, rewardCoins: 40, type: "daily" },
  { key: "score_2_goals", description: "Score 2+ goals in a match", target: 1, rewardCoins: 35, type: "daily" },
  { key: "play_any_3", description: "Play 3 matches (any mode)", target: 3, rewardCoins: 25, type: "daily" },
  { key: "win_2_ranked", description: "Win 2 ranked matches", target: 2, rewardCoins: 60, type: "daily" },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { key: "win_5_ranked", description: "Win 5 ranked matches", target: 5, rewardCoins: 200, type: "weekly" },
  { key: "score_10_goals", description: "Score 10+ goals total", target: 10, rewardCoins: 150, type: "weekly" },
  { key: "play_10_matches", description: "Play 10 matches", target: 10, rewardCoins: 100, type: "weekly" },
  { key: "earn_50_div_pts", description: "Earn 50+ division points", target: 50, rewardCoins: 250, type: "weekly" },
];

// Pick random missions for today
export function pickDailyMissions(count: number = 3): MissionDef[] {
  const shuffled = [...DAILY_MISSIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function pickWeeklyMissions(count: number = 2): MissionDef[] {
  const shuffled = [...WEEKLY_MISSIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Determine which missions get progress from a match result
export function getMatchMissionUpdates(
  matchResult: {
    matchType: string;
    homeScore: number;
    awayScore: number;
    isHome: boolean;
    divPointsChange: number;
  },
  activeMissions: { mission_key: string; progress: number; target: number }[]
): { mission_key: string; progressDelta: number }[] {
  const updates: { mission_key: string; progressDelta: number }[] = [];
  const myScore = matchResult.isHome ? matchResult.homeScore : matchResult.awayScore;
  const theirScore = matchResult.isHome ? matchResult.awayScore : matchResult.homeScore;
  const isWin = myScore > theirScore;
  const isRanked = matchResult.matchType === "ranked";
  const isCleanSheet = theirScore === 0;

  for (const mission of activeMissions) {
    if (mission.progress >= mission.target) continue;

    let delta = 0;
    switch (mission.mission_key) {
      case "play_ranked_3":
      case "win_2_ranked":
        if (isRanked) {
          if (mission.mission_key === "play_ranked_3") delta = 1;
          if (mission.mission_key === "win_2_ranked" && isWin) delta = 1;
        }
        break;
      case "win_match":
        if (isWin) delta = 1;
        break;
      case "clean_sheet":
        if (isCleanSheet && isWin) delta = 1;
        break;
      case "score_2_goals":
        if (myScore >= 2) delta = 1;
        break;
      case "play_any_3":
      case "play_10_matches":
        delta = 1;
        break;
      case "win_5_ranked":
        if (isRanked && isWin) delta = 1;
        break;
      case "score_10_goals":
        delta = myScore;
        break;
      case "earn_50_div_pts":
        if (matchResult.divPointsChange > 0) delta = matchResult.divPointsChange;
        break;
    }

    if (delta > 0) {
      updates.push({ mission_key: mission.mission_key, progressDelta: delta });
    }
  }

  return updates;
}
