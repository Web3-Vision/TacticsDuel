import type { EventType, MatchEvent } from "../types";

interface CommentaryContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homePossession: number;
}

type TemplateVars = {
  player: string;
  player2: string;
  team: string;
  opponent: string;
  minute: number;
  score: string;
};

function fill(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{player\}/g, vars.player)
    .replace(/\{player2\}/g, vars.player2)
    .replace(/\{team\}/g, vars.team)
    .replace(/\{opponent\}/g, vars.opponent)
    .replace(/\{minute\}/g, String(vars.minute))
    .replace(/\{score\}/g, vars.score);
}

const TEMPLATES: Record<string, string[]> = {
  goal: [
    "GOAL! {player} finds the back of the net! {score}",
    "GOAAAL! {player} scores for {team}! {score}",
    "{player} makes no mistake from close range! {score}",
    "A clinical finish from {player}! {score}",
    "It's in! {player} with a brilliant strike! {score}",
    "GOAL! {player2} sets up {player} who finishes coolly. {score}",
    "What a goal! {player} curls it into the corner! {score}",
    "{player} heads it home! Assist from {player2}. {score}",
    "He's done it! {player} with the goal for {team}! {score}",
    "The net bulges! {player} with a powerful shot! {score}",
  ],
  shot_saved: [
    "Good save! {player}'s shot is tipped away by the keeper.",
    "The goalkeeper denies {player} with a fine stop.",
    "{player} tests the keeper, but the shot is pushed wide.",
    "A decent effort from {player}, but the goalkeeper is equal to it.",
    "Sharp save from the keeper to deny {player}.",
    "The keeper gets down low to save from {player}.",
    "{player} forces a good save with a shot from range.",
    "Close! {player}'s effort is parried by the goalkeeper.",
  ],
  shot_missed: [
    "{player} fires wide of the target.",
    "That's off target from {player}. Wasteful.",
    "{player} blazes it over the bar.",
    "Wild effort from {player}, that's gone into the stands.",
    "{player} drags the shot wide. Should have done better.",
    "The shot from {player} curls just wide of the far post.",
    "{player} snatches at it and puts it over.",
    "Off target! {player} will be disappointed with that.",
  ],
  shot_blocked: [
    "{player}'s shot is blocked by the defender.",
    "Good block! The defence stands firm to deny {player}.",
    "{player} tries to shoot but it's charged down.",
    "The shot from {player} is blocked. Corner.",
    "Brave block to stop {player}'s goal-bound effort.",
  ],
  chance_created: [
    "{player} plays a lovely ball through for {player2}.",
    "Great vision from {player}, threading a pass to {player2}.",
    "{player} picks out {player2} with a perfect through ball.",
    "Clever play by {player}, creating space for {player2}.",
    "{player} with a dangerous cross towards {player2}.",
    "Long ball over the top! {player} finds {player2} in space!",
    "Quick tempo play! {player} releases {player2} with a first-time pass.",
    "Wide play opens up the defence! {player} delivers for {player2}.",
  ],
  tackle: [
    "Strong tackle by {player}! Wins the ball cleanly.",
    "{player} slides in and takes the ball.",
    "Excellent challenge from {player}, breaking up the attack.",
    "{player} times the tackle perfectly.",
    "Good recovery tackle from {player}.",
    "High press forces a turnover! {player} wins it back for {team}.",
    "{player} presses hard and forces the error!",
    "Aggressive pressing by {team}! {player} recovers possession.",
  ],
  interception: [
    "{player} reads the pass and intercepts.",
    "Well read by {player}, stepping in to cut out the danger.",
    "{player} anticipates the through ball.",
    "Interception by {player}. Good defensive awareness.",
    "Solid defensive shape holds firm! {player} cuts out the pass.",
    "{player} reads the play perfectly. Compact defending from {team}.",
  ],
  foul: [
    "Foul by {player} on {player2}. Free kick.",
    "{player} goes in late on {player2}. Referee blows.",
    "That's a foul. {player} catches {player2}.",
    "{player} clips {player2}'s heels. Free kick awarded.",
  ],
  yellow_card: [
    "Yellow card for {player}. The referee reaches for his pocket.",
    "{player} is booked. He'll need to be careful now.",
    "That's a booking for {player}. Cynical challenge.",
    "Yellow for {player}. He knew what he was doing there.",
  ],
  red_card: [
    "RED CARD! {player} is sent off! {team} down to ten men!",
    "Straight red for {player}! That's a terrible challenge.",
    "Off he goes! {player} gets a second yellow and is dismissed.",
  ],
  corner: [
    "Corner kick for {team}.",
    "{team} win a corner. {player} to take it.",
    "The ball is deflected behind. Corner for {team}.",
  ],
  commentary_early: [
    "The teams are settling into the match.",
    "A cagey start to the game.",
    "Both sides are feeling each other out.",
    "The tempo is building gradually.",
  ],
  commentary_dominant: [
    "{team} are keeping the ball well, dominating possession.",
    "It's all {team} at the moment. The opposition can't get a touch.",
    "{team} are in complete control here.",
    "Relentless pressure from {team}.",
  ],
  commentary_tense: [
    "This is a tense affair. Neither side willing to commit forward.",
    "End-to-end stuff! Both teams creating chances.",
    "The atmosphere is electric. Everything on the line here.",
    "You can feel the tension. A single mistake could decide this.",
  ],
  commentary_late_close: [
    "Desperation creeping in as the clock ticks down.",
    "We're into the final minutes and it's still anyone's game.",
    "Time running out. Can anyone find a winner?",
    "Squeaky bum time. The fans are on the edge of their seats.",
  ],
};

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateCommentary(
  type: string,
  vars: TemplateVars,
  rng: () => number
): string {
  const templates = TEMPLATES[type];
  if (!templates || templates.length === 0) return "";
  return fill(pick(templates, rng), vars);
}

export function generateAtmosphericCommentary(
  ctx: CommentaryContext,
  rng: () => number
): string | null {
  const { minute, homeScore, awayScore, homePossession } = ctx;
  const goalDiff = Math.abs(homeScore - awayScore);
  const total = homeScore + awayScore;

  // Early game
  if (minute < 10 && total === 0) {
    return pick(TEMPLATES.commentary_early, rng);
  }

  // Dominant possession
  if (homePossession > 65) {
    return fill(pick(TEMPLATES.commentary_dominant, rng), {
      player: "",
      player2: "",
      team: ctx.homeTeam,
      opponent: ctx.awayTeam,
      minute,
      score: `${homeScore}-${awayScore}`,
    });
  }
  if (homePossession < 35) {
    return fill(pick(TEMPLATES.commentary_dominant, rng), {
      player: "",
      player2: "",
      team: ctx.awayTeam,
      opponent: ctx.homeTeam,
      minute,
      score: `${homeScore}-${awayScore}`,
    });
  }

  // Late and close
  if (minute > 80 && goalDiff <= 1) {
    return pick(TEMPLATES.commentary_late_close, rng);
  }

  // Tense
  if (goalDiff === 0 && minute > 30) {
    if (rng() < 0.3) return pick(TEMPLATES.commentary_tense, rng);
  }

  return null;
}
