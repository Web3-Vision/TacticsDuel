// ============================================
// PLAYER TYPES
// ============================================

export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CM' | 'LW' | 'RW' | 'ST';

export type PlayerVariant = 'base' | 'in_form' | 'totw' | 'icon';
export type PlayerRarity = 'bronze' | 'silver' | 'gold' | 'special';

export interface Player {
  id: string;
  name: string;
  fullName: string;
  nationality: string;
  club: string;
  position: Position;
  age: number;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeping: number;
  marketValue: number;
  variant: PlayerVariant;
  rarity: PlayerRarity;
}

// ============================================
// FORMATION TYPES
// ============================================

export interface FormationSlot {
  position: Position;
  x: number; // 0-100 on pitch
  y: number; // 0-100 on pitch
  label: string; // e.g. "LCB", "RCM"
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

// ============================================
// SQUAD TYPES
// ============================================

export interface SquadSlot {
  slotIndex: number;
  playerId: string | null;
  position: Position;
}

// ============================================
// TACTICS TYPES
// ============================================

export type Mentality = 'Defensive' | 'Cautious' | 'Balanced' | 'Attacking' | 'All-out Attack';
export type Tempo = 'Slow' | 'Normal' | 'Fast';
export type Pressing = 'Low' | 'Medium' | 'High';
export type Width = 'Narrow' | 'Normal' | 'Wide';

export interface Tactics {
  formation: string;
  mentality: Mentality;
  tempo: Tempo;
  pressing: Pressing;
  width: Width;
  htIfLosingFormation?: string;
  htIfLosingMentality?: Mentality;
  htIfWinningMentality?: Mentality;
}

// ============================================
// MATCH TYPES
// ============================================

export type EventType =
  | 'kickoff' | 'halftime' | 'fulltime'
  | 'goal' | 'shot_saved' | 'shot_missed' | 'shot_blocked'
  | 'chance_created' | 'through_ball' | 'cross'
  | 'tackle' | 'interception' | 'clearance'
  | 'foul' | 'yellow_card' | 'red_card'
  | 'corner' | 'free_kick'
  | 'substitution'
  | 'possession_change'
  | 'commentary';

export interface MatchEvent {
  minute: number;
  type: EventType;
  team: 'home' | 'away' | 'neutral';
  primaryPlayer?: string;
  secondaryPlayer?: string;
  description: string;
  isKeyEvent: boolean;
  detail?: Record<string, unknown>;
}

export interface MatchStats {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homePassAccuracy: number;
  awayPassAccuracy: number;
}

export interface MatchConfig {
  homeSquad: Player[];
  awaySquad: Player[];
  homeTactics: Tactics;
  awayTactics: Tactics;
  matchType: 'ranked' | 'friendly' | 'draft' | 'ai';
}

export interface MatchResult {
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
  stats: MatchStats;
  playerRatings: Record<string, number>;
  manOfTheMatch: string;
}

export type MatchType = 'ranked' | 'friendly' | 'draft' | 'ai';
export type MatchStatus = 'pending' | 'accepted' | 'simulating' | 'completed' | 'cancelled';

// Phase result for interactive match simulation
export interface PhaseResult {
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
  homePossCount: number;
  awayPossCount: number;
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  playerEvents: Record<string, { positive: number; negative: number; involved: number }>;
}

// ============================================
// DIVISION TYPES
// ============================================

export interface Division {
  id: number;
  name: string;
  pointsToPromote: number | null;
  rewardCoins: number;
}

// ============================================
// PROFILE TYPES
// ============================================

export interface Profile {
  id: string;
  username: string;
  club_name: string;
  division: number;
  division_points: number;
  elo_rating: number;
  coins: number;
  wins: number;
  draws: number;
  losses: number;
  current_streak: number;
  best_streak: number;
  favorite_team?: string;
  age?: number;
  captain_player_id?: string;
  onboarding_completed: boolean;
  wallet_address?: string;
  created_at: string;
  // Ranked cycle
  squad_locked: boolean;
  ranked_matches_in_cycle: number;
  transfers_remaining: number;
  squad_confirmed_at: string | null;
  cycle_id: number;
  // Division season
  division_wins: number;
  division_draws: number;
  division_losses: number;
  division_season: number;
  division_matches_played: number;
}
