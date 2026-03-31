import type { MatchPhase, SessionSide } from "./session-service";

export type TimelineState = "completed" | "current" | "upcoming";

export interface TimelineItem {
  phase: MatchPhase;
  label: string;
  state: TimelineState;
  message: string;
}

export interface MatchdaySessionView {
  id: string;
  status: "waiting" | "active" | "completed";
  roomCode: string;
  turnNumber: number;
  phase: MatchPhase;
  activeSide: SessionSide;
  createdByUserId: string;
  participants: Array<{
    userId: string;
    side: SessionSide;
    connected: boolean;
    joinedAt: string;
    lastSeenAt: string;
  }>;
  you: {
    userId: string;
    side: SessionSide;
    connected: boolean;
  } | null;
}

export interface ReconnectViewModel {
  state: "ready" | "needs_session" | "already_connected" | "session_completed" | "inactive";
  canReconnect: boolean;
  message: string;
}

const PHASE_ORDER: MatchPhase[] = ["lobby", "first_half", "halftime", "second_half", "fulltime"];

const PHASE_LABELS: Record<MatchPhase, string> = {
  lobby: "Lobby",
  first_half: "First Half",
  halftime: "Halftime",
  second_half: "Second Half",
  fulltime: "Fulltime",
};

const PHASE_MESSAGES: Record<MatchPhase, string> = {
  lobby: "Players are joining and readying kickoff.",
  first_half: "Match is live. Tactical control is active.",
  halftime: "Mid-game break. Confirm second-half plan.",
  second_half: "Final tactical window before fulltime.",
  fulltime: "Match completed. Results are locked.",
};

export function nextPhase(phase: MatchPhase): MatchPhase | null {
  const currentIndex = PHASE_ORDER.indexOf(phase);
  if (currentIndex < 0 || currentIndex >= PHASE_ORDER.length - 1) {
    return null;
  }

  return PHASE_ORDER[currentIndex + 1] ?? null;
}

export function buildTimeline(currentPhase: MatchPhase): TimelineItem[] {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return PHASE_ORDER.map((phase, index) => {
    let state: TimelineState = "upcoming";
    if (index < currentIndex) {
      state = "completed";
    } else if (index === currentIndex) {
      state = "current";
    }

    return {
      phase,
      label: PHASE_LABELS[phase],
      state,
      message: PHASE_MESSAGES[phase],
    };
  });
}

export function fixtureStatusSummary(session: MatchdaySessionView | null): string {
  if (!session) {
    return "No active fixture selected";
  }

  if (session.status === "waiting") {
    return "Waiting for opponent to join";
  }

  if (session.status === "completed") {
    return "Fixture completed";
  }

  return `Live in ${PHASE_LABELS[session.phase]}`;
}

export function buildReconnectViewModel(session: MatchdaySessionView | null, hasSessionId: boolean): ReconnectViewModel {
  if (!hasSessionId) {
    return {
      state: "needs_session",
      canReconnect: false,
      message: "Enter or restore a session id to reconnect.",
    };
  }

  if (!session) {
    return {
      state: "ready",
      canReconnect: true,
      message: "Session id is present. Reconnect to restore match state.",
    };
  }

  if (session.status === "completed") {
    return {
      state: "session_completed",
      canReconnect: false,
      message: "Session is already completed.",
    };
  }

  if (session.you?.connected) {
    return {
      state: "already_connected",
      canReconnect: false,
      message: "You are connected in this session.",
    };
  }

  if (session.status === "waiting") {
    return {
      state: "inactive",
      canReconnect: true,
      message: "Session is waiting in lobby. Reconnect is available.",
    };
  }

  return {
    state: "ready",
    canReconnect: true,
    message: "Ready to reconnect and resume live play.",
  };
}
