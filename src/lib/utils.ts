import type { Position, PlayerRarity } from "./types";

export function calculatePrice(overall: number): number {
  if (overall >= 90) return Math.round(80 + (overall - 90) * 25);
  if (overall >= 85) return Math.round(30 + (overall - 85) * 10);
  if (overall >= 80) return Math.round(12 + (overall - 80) * 3.6);
  if (overall >= 75) return Math.round(5 + (overall - 75) * 1.4);
  return Math.round(2 + (overall - 70) * 0.6);
}

export function getRarity(overall: number): PlayerRarity {
  if (overall >= 85) return "gold";
  if (overall >= 75) return "silver";
  return "bronze";
}

export type CardTier = "bronze" | "silver" | "gold" | "elite";

export interface CardTierStyle {
  tier: CardTier;
  border: string;
  bg: string;
  text: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}

export function getCardTier(overall: number): CardTierStyle {
  if (overall >= 86) return {
    tier: "elite",
    border: "#00FF41",
    bg: "#0a1a0f",
    text: "#00FF41",
    borderClass: "border-[#00FF41]",
    bgClass: "bg-[#0a1a0f]",
    textClass: "text-[#00FF41]",
  };
  if (overall >= 80) return {
    tier: "gold",
    border: "#FFD700",
    bg: "#2a2410",
    text: "#FFD700",
    borderClass: "border-[#FFD700]",
    bgClass: "bg-[#2a2410]",
    textClass: "text-[#FFD700]",
  };
  if (overall >= 70) return {
    tier: "silver",
    border: "#C0C0C0",
    bg: "#1e2024",
    text: "#C0C0C0",
    borderClass: "border-[#C0C0C0]",
    bgClass: "bg-[#1e2024]",
    textClass: "text-[#C0C0C0]",
  };
  return {
    tier: "bronze",
    border: "#CD7F32",
    bg: "#2a1f14",
    text: "#CD7F32",
    borderClass: "border-[#CD7F32]",
    bgClass: "bg-[#2a1f14]",
    textClass: "text-[#CD7F32]",
  };
}

export function formatPrice(millions: number): string {
  return `€${millions}M`;
}

export function formatPosition(position: Position): string {
  return position;
}

export function positionColor(position: Position): string {
  switch (position) {
    case "GK":
      return "text-gold";
    case "CB":
    case "LB":
    case "RB":
      return "text-home";
    case "CM":
      return "text-accent";
    case "LW":
    case "RW":
    case "ST":
      return "text-away";
  }
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export interface EloRank {
  label: string;
  color: string;
}

export function getEloRank(elo: number): EloRank {
  if (elo >= 2000) return { label: "Elite", color: "#00FF41" };
  if (elo >= 1500) return { label: "Gold", color: "#FFD700" };
  if (elo >= 1000) return { label: "Silver", color: "#C0C0C0" };
  return { label: "Bronze", color: "#CD7F32" };
}

export const SALARY_CAP = 2000;

export const DIVISIONS: {
  id: number;
  name: string;
  pointsToPromote: number | null;
  rewardCoins: number;
}[] = [
  { id: 10, name: "Amateur", pointsToPromote: 30, rewardCoins: 100 },
  { id: 9, name: "Semi-Pro", pointsToPromote: 40, rewardCoins: 200 },
  { id: 8, name: "Professional", pointsToPromote: 50, rewardCoins: 350 },
  { id: 7, name: "Championship", pointsToPromote: 60, rewardCoins: 500 },
  { id: 6, name: "Premier", pointsToPromote: 70, rewardCoins: 750 },
  { id: 5, name: "Elite", pointsToPromote: 80, rewardCoins: 1000 },
  { id: 4, name: "World Class", pointsToPromote: 90, rewardCoins: 1500 },
  { id: 3, name: "Legendary", pointsToPromote: 100, rewardCoins: 2000 },
  { id: 2, name: "Ultimate", pointsToPromote: 120, rewardCoins: 3000 },
  { id: 1, name: "Ballon d'Or", pointsToPromote: null, rewardCoins: 5000 },
];
