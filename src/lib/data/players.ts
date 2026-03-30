import { calculatePrice, getRarity } from "../utils";
import type { Player, Position } from "../types";
import { GK_DATA } from "./players-gk";
import { DEF_DATA } from "./players-def";
import { MID_DATA } from "./players-mid";
import { ATT_DATA } from "./players-att";
import { ST_DATA } from "./players-st";
import { ICON_DATA } from "./players-icons";

export type PlayerTuple = [
  id: string, name: string, fullName: string, nationality: string,
  club: string, position: Position, age: number, overall: number,
  pace: number, shooting: number, passing: number, dribbling: number,
  defending: number, physical: number, goalkeeping: number,
  variant?: Player["variant"]
];

function fromTuple([id, name, fullName, nationality, club, position, age, overall, pace, shooting, passing, dribbling, defending, physical, goalkeeping, variant = "base"]: PlayerTuple): Player {
  const price = calculatePrice(overall);
  return {
    id, name, fullName, nationality, club, position, age, overall,
    pace, shooting, passing, dribbling, defending, physical, goalkeeping,
    marketValue: variant === "icon" ? Math.round(price * 1.5) : price,
    variant,
    rarity: variant === "icon" ? "special" : getRarity(overall),
  };
}

export const PLAYERS: Player[] = [
  ...GK_DATA, ...DEF_DATA, ...MID_DATA, ...ATT_DATA, ...ST_DATA, ...ICON_DATA
].map(fromTuple);

export function getPlayersByPosition(position: Position): Player[] {
  return PLAYERS.filter((p) => p.position === position);
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function searchPlayers(query: string): Player[] {
  const q = query.toLowerCase();
  return PLAYERS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.club.toLowerCase().includes(q)
  );
}
