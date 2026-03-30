/**
 * Match Engine Calibration Script
 * Run: npx tsx scripts/calibrate.ts
 *
 * Simulates 500 matches and reports key statistics to verify
 * the engine produces realistic results.
 */

import { simulateMatch } from "../src/lib/engine/match-engine";
import { generateAISquad, generateAITactics } from "../src/lib/engine/ai-opponent";
import { PLAYERS } from "../src/lib/data/players";
import { FORMATIONS } from "../src/lib/data/formations";
import type { MatchResult } from "../src/lib/types";

const NUM_SIMS = 500;

const results: {
  homeScore: number;
  awayScore: number;
  totalGoals: number;
  possession: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
}[] = [];

console.log(`Running ${NUM_SIMS} simulations...\n`);

for (let i = 0; i < NUM_SIMS; i++) {
  const homeFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
  const awayFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];

  const homePositions = homeFormation.slots.map((s) => s.position);
  const awayPositions = awayFormation.slots.map((s) => s.position);

  const homeSquad = generateAISquad(PLAYERS, homePositions);
  const awaySquad = generateAISquad(PLAYERS, awayPositions);

  const homeTactics = generateAITactics();
  const awayTactics = generateAITactics();

  const result: MatchResult = simulateMatch(
    { homeSquad, awaySquad, homeTactics, awayTactics, matchType: "ai" },
    i
  );

  results.push({
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    totalGoals: result.homeScore + result.awayScore,
    possession: result.stats.homePossession,
    homeShots: result.stats.homeShots,
    awayShots: result.stats.awayShots,
    homeOnTarget: result.stats.homeOnTarget,
    awayOnTarget: result.stats.awayOnTarget,
  });
}

// --- Calculate stats ---

const totalGoals = results.reduce((s, r) => s + r.totalGoals, 0);
const avgGoals = totalGoals / NUM_SIMS;

const draws = results.filter((r) => r.homeScore === r.awayScore).length;
const drawPct = (draws / NUM_SIMS) * 100;

const homeWins = results.filter((r) => r.homeScore > r.awayScore).length;
const awayWins = results.filter((r) => r.homeScore < r.awayScore).length;

const avgPossession = results.reduce((s, r) => s + r.possession, 0) / NUM_SIMS;
const avgShots = results.reduce((s, r) => s + r.homeShots + r.awayShots, 0) / NUM_SIMS;
const avgOnTarget = results.reduce((s, r) => s + r.homeOnTarget + r.awayOnTarget, 0) / NUM_SIMS;

// Goals histogram
const goalsHist: Record<number, number> = {};
for (const r of results) {
  const bucket = Math.min(r.totalGoals, 8);
  goalsHist[bucket] = (goalsHist[bucket] ?? 0) + 1;
}

// Goal difference
const bigDiffs = results.filter((r) => Math.abs(r.homeScore - r.awayScore) >= 4).length;
const bigDiffPct = (bigDiffs / NUM_SIMS) * 100;

const maxGoalDiff = Math.max(...results.map((r) => Math.abs(r.homeScore - r.awayScore)));

// --- Report ---

console.log("=== MATCH ENGINE CALIBRATION REPORT ===\n");
console.log(`Simulations: ${NUM_SIMS}`);
console.log(`Avg goals/match: ${avgGoals.toFixed(2)} (target: ~2.5)`);
console.log(`Draw rate: ${drawPct.toFixed(1)}% (target: ~25%)`);
console.log(`Home wins: ${((homeWins / NUM_SIMS) * 100).toFixed(1)}%`);
console.log(`Away wins: ${((awayWins / NUM_SIMS) * 100).toFixed(1)}%`);
console.log(`Draws: ${drawPct.toFixed(1)}%`);
console.log(`Avg possession (home): ${avgPossession.toFixed(1)}%`);
console.log(`Avg shots/match: ${avgShots.toFixed(1)}`);
console.log(`Avg on-target/match: ${avgOnTarget.toFixed(1)}`);
console.log(`Big diff (|diff| >= 4): ${bigDiffPct.toFixed(1)}% (target: <5%)`);
console.log(`Max goal difference: ${maxGoalDiff}`);

console.log("\nGoals distribution:");
for (let g = 0; g <= 8; g++) {
  const count = goalsHist[g] ?? 0;
  const pct = ((count / NUM_SIMS) * 100).toFixed(1);
  const bar = "█".repeat(Math.round(count / NUM_SIMS * 50));
  const label = g === 8 ? "8+" : String(g);
  console.log(`  ${label} goals: ${bar} ${pct}% (${count})`);
}

console.log("\n=== VERDICT ===");
const goalsOk = avgGoals >= 2.0 && avgGoals <= 3.5;
const drawsOk = drawPct >= 15 && drawPct <= 35;
const diffOk = bigDiffPct < 10;

console.log(`Goals: ${goalsOk ? "✓ PASS" : "✗ FAIL"} (${avgGoals.toFixed(2)})`);
console.log(`Draws: ${drawsOk ? "✓ PASS" : "✗ FAIL"} (${drawPct.toFixed(1)}%)`);
console.log(`Big diffs: ${diffOk ? "✓ PASS" : "✗ FAIL"} (${bigDiffPct.toFixed(1)}%)`);
console.log(`\nOverall: ${goalsOk && drawsOk && diffOk ? "✓ ALL PASS" : "✗ NEEDS TUNING"}`);
