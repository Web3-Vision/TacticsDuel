export const MANAGER_ARCHETYPES = [
  "Classic Touchline",
  "Tactical Visionary",
  "Street General",
  "Data-Driven Analyst",
] as const;

export const HAIR_STYLES = [
  "Buzz Cut",
  "Short Fade",
  "Curly Top",
  "Slick Back",
  "Bald",
] as const;

export const HAIR_COLORS = [
  "Black",
  "Dark Brown",
  "Brown",
  "Blonde",
  "Ginger",
  "Grey",
] as const;

export const SKIN_TONES = [
  "Fair",
  "Light",
  "Olive",
  "Tan",
  "Brown",
  "Deep",
] as const;

export const BEARD_STYLES = [
  "Clean Shaven",
  "Stubble",
  "Goatee",
  "Boxed Beard",
  "Full Beard",
] as const;

export const ACCOUNT_STATUSES = ["active", "paused", "deactivated"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type ManagerArchetype = (typeof MANAGER_ARCHETYPES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type SkinTone = (typeof SKIN_TONES)[number];
export type BeardStyle = (typeof BEARD_STYLES)[number];
