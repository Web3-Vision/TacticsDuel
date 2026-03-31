import { create } from "zustand";
import type { MatchEvent, MatchStats, MatchResult } from "../types";

interface MatchState {
  events: MatchEvent[];
  visibleEvents: MatchEvent[];
  currentIndex: number;
  isPlaying: boolean;
  speed: 1 | 2 | 3;
  keyEventsOnly: boolean;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  stats: MatchStats | null;
  playerRatings: Record<string, number>;
  manOfTheMatch: string;
  isFinished: boolean;
  homeTeam: string;
  awayTeam: string;
  homeFormation: string;
  awayFormation: string;
  currentPossession: "home" | "away";

  loadMatch: (result: MatchResult, homeTeam: string, awayTeam: string, homeFormation?: string, awayFormation?: string) => void;
  loadReplay: (events: MatchEvent[], stats: MatchStats | null, homeTeam: string, awayTeam: string) => void;
  tick: () => void;
  setSpeed: (speed: 1 | 2 | 3) => void;
  togglePlay: () => void;
  toggleKeyOnly: () => void;
  skipToEnd: () => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  events: [],
  visibleEvents: [],
  currentIndex: 0,
  isPlaying: false,
  speed: 2,
  keyEventsOnly: false,
  homeScore: 0,
  awayScore: 0,
  currentMinute: 0,
  stats: null,
  playerRatings: {},
  manOfTheMatch: "",
  isFinished: false,
  homeTeam: "Home",
  awayTeam: "Away",
  homeFormation: "4-3-3",
  awayFormation: "4-3-3",
  currentPossession: "home",

  loadMatch: (result, homeTeam, awayTeam, homeFormation, awayFormation) => {
    set({
      events: result.events,
      visibleEvents: [],
      currentIndex: 0,
      isPlaying: true,
      homeScore: 0,
      awayScore: 0,
      currentMinute: 0,
      stats: result.stats,
      playerRatings: result.playerRatings,
      manOfTheMatch: result.manOfTheMatch,
      isFinished: false,
      homeTeam,
      awayTeam,
      homeFormation: homeFormation ?? "4-3-3",
      awayFormation: awayFormation ?? "4-3-3",
      currentPossession: "home",
    });
  },

  loadReplay: (events, stats, homeTeam, awayTeam) => {
    set({
      events,
      visibleEvents: [],
      currentIndex: 0,
      isPlaying: true,
      homeScore: 0,
      awayScore: 0,
      currentMinute: 0,
      stats,
      playerRatings: {},
      manOfTheMatch: "",
      isFinished: false,
      homeTeam,
      awayTeam,
    });
  },

  tick: () => {
    const state = get();
    if (state.currentIndex >= state.events.length) {
      set({ isPlaying: false, isFinished: true });
      return;
    }

    const event = state.events[state.currentIndex];

    // Update score from goal events
    let newHomeScore = state.homeScore;
    let newAwayScore = state.awayScore;
    if (event.type === "goal") {
      if (event.team === "home") newHomeScore++;
      else newAwayScore++;
    }

    // Track possession changes
    let newPossession = state.currentPossession;
    if (event.type === "possession_change" && (event.team === "home" || event.team === "away")) {
      newPossession = event.team;
    }

    set({
      currentIndex: state.currentIndex + 1,
      visibleEvents: [...state.visibleEvents, event],
      currentMinute: event.minute,
      homeScore: newHomeScore,
      awayScore: newAwayScore,
      currentPossession: newPossession,
    });
  },

  setSpeed: (speed) => set({ speed }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  toggleKeyOnly: () => set((s) => ({ keyEventsOnly: !s.keyEventsOnly })),

  skipToEnd: () => {
    const state = get();
    let homeScore = 0;
    let awayScore = 0;
    for (const e of state.events) {
      if (e.type === "goal") {
        if (e.team === "home") homeScore++;
        else awayScore++;
      }
    }
    set({
      visibleEvents: state.events,
      currentIndex: state.events.length,
      isPlaying: false,
      isFinished: true,
      homeScore,
      awayScore,
      currentMinute: 90,
    });
  },

  reset: () =>
    set({
      events: [],
      visibleEvents: [],
      currentIndex: 0,
      isPlaying: false,
      speed: 2,
      keyEventsOnly: false,
      homeScore: 0,
      awayScore: 0,
      currentMinute: 0,
      stats: null,
      playerRatings: {},
      manOfTheMatch: "",
      isFinished: false,
      homeFormation: "4-3-3",
      awayFormation: "4-3-3",
      currentPossession: "home",
    }),
}));
