import type { MatchEvent, MatchStats, MatchType } from "@/lib/types";

type TaxonomyBucket =
  | "match_state"
  | "scoring"
  | "discipline"
  | "chance"
  | "set_piece"
  | "possession"
  | "tactical"
  | "commentary"
  | "other";

const EVENT_BUCKET: Partial<Record<MatchEvent["type"], TaxonomyBucket>> = {
  kickoff: "match_state",
  halftime: "match_state",
  fulltime: "match_state",
  goal: "scoring",
  shot_saved: "chance",
  shot_missed: "chance",
  shot_blocked: "chance",
  chance_created: "chance",
  through_ball: "chance",
  cross: "chance",
  tackle: "tactical",
  interception: "tactical",
  clearance: "tactical",
  foul: "discipline",
  yellow_card: "discipline",
  red_card: "discipline",
  corner: "set_piece",
  free_kick: "set_piece",
  substitution: "tactical",
  possession_change: "possession",
  commentary: "commentary",
};

export interface RoundRecapRow {
  match_id: string;
  round_index: number;
  event_digest: string;
  recap: {
    schemaVersion: 1;
    matchType: MatchType;
    scoreline: { home: number; away: number };
    stats: MatchStats;
    keyMoments: Array<{
      minute: number;
      type: MatchEvent["type"];
      team: MatchEvent["team"];
      description: string;
    }>;
  };
}

export interface InboxMessageRow {
  user_id: string;
  match_id: string;
  message_key: string;
  event_digest: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export interface NewsFeedItemRow {
  match_id: string;
  story_key: string;
  event_digest: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
}

interface BuildNarrativeInput {
  matchId: string;
  matchType: MatchType;
  homeUserId: string;
  awayUserId: string | null;
  homeScore: number;
  awayScore: number;
  stats: MatchStats;
  events: MatchEvent[];
}

function bucketForEvent(event: MatchEvent): TaxonomyBucket {
  return EVENT_BUCKET[event.type] ?? "other";
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hashFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function eventDigest(events: MatchEvent[]): string {
  const canonical = events
    .map((event, index) => {
      const bucket = bucketForEvent(event);
      return [
        index,
        event.minute,
        event.type,
        bucket,
        event.team,
        normalizeText(event.primaryPlayer),
        normalizeText(event.secondaryPlayer),
        normalizeText(event.description),
      ].join("|");
    })
    .join("||");

  return hashFnv1a(canonical);
}

function keyMoments(events: MatchEvent[]) {
  return events
    .filter((event) => event.isKeyEvent)
    .map((event) => ({
      minute: event.minute,
      type: event.type,
      team: event.team,
      description: event.description,
    }))
    .slice(0, 8);
}

function summarizeOutcome(homeScore: number, awayScore: number): {
  homeTitle: string;
  awayTitle: string;
  publicOutcome: string;
} {
  if (homeScore > awayScore) {
    return {
      homeTitle: "Victory secured",
      awayTitle: "Defeat recorded",
      publicOutcome: `Home side won ${homeScore}-${awayScore}`,
    };
  }

  if (homeScore < awayScore) {
    return {
      homeTitle: "Defeat recorded",
      awayTitle: "Victory secured",
      publicOutcome: `Away side won ${awayScore}-${homeScore}`,
    };
  }

  return {
    homeTitle: "Draw settled",
    awayTitle: "Draw settled",
    publicOutcome: `Match ended level at ${homeScore}-${awayScore}`,
  };
}

function buildInboxMessage(
  userId: string,
  side: "home" | "away",
  input: BuildNarrativeInput,
  digest: string,
  moments: ReturnType<typeof keyMoments>
): InboxMessageRow {
  const outcome = summarizeOutcome(input.homeScore, input.awayScore);
  const title = side === "home" ? outcome.homeTitle : outcome.awayTitle;

  return {
    user_id: userId,
    match_id: input.matchId,
    message_key: `${side}-fulltime-summary`,
    event_digest: digest,
    title: `${title}: ${input.homeScore}-${input.awayScore}`,
    body: `${input.matchType.toUpperCase()} match completed with ${moments.length} key moments in recap.`,
    payload: {
      side,
      matchType: input.matchType,
      scoreline: `${input.homeScore}-${input.awayScore}`,
      keyMomentCount: moments.length,
    },
  };
}

export function buildNarrativeArtifacts(input: BuildNarrativeInput): {
  roundRecap: RoundRecapRow;
  inboxMessages: InboxMessageRow[];
  newsItems: NewsFeedItemRow[];
} {
  const digest = eventDigest(input.events);
  const moments = keyMoments(input.events);
  const outcome = summarizeOutcome(input.homeScore, input.awayScore);
  const redCards = input.events.filter((event) => event.type === "red_card");

  const roundRecap: RoundRecapRow = {
    match_id: input.matchId,
    round_index: 1,
    event_digest: digest,
    recap: {
      schemaVersion: 1,
      matchType: input.matchType,
      scoreline: { home: input.homeScore, away: input.awayScore },
      stats: input.stats,
      keyMoments: moments,
    },
  };

  const inboxMessages: InboxMessageRow[] = [
    buildInboxMessage(input.homeUserId, "home", input, digest, moments),
  ];

  if (input.awayUserId) {
    inboxMessages.push(buildInboxMessage(input.awayUserId, "away", input, digest, moments));
  }

  const newsItems: NewsFeedItemRow[] = [
    {
      match_id: input.matchId,
      story_key: "fulltime-result",
      event_digest: digest,
      title: "Full-time report",
      summary: outcome.publicOutcome,
      payload: {
        scoreline: `${input.homeScore}-${input.awayScore}`,
        matchType: input.matchType,
      },
    },
  ];

  if (redCards.length > 0) {
    newsItems.push({
      match_id: input.matchId,
      story_key: "discipline-alert",
      event_digest: digest,
      title: "Discipline watch",
      summary: `${redCards.length} red card${redCards.length > 1 ? "s" : ""} influenced the result.`,
      payload: {
        count: redCards.length,
        minutes: redCards.map((event) => event.minute),
      },
    });
  }

  return {
    roundRecap,
    inboxMessages,
    newsItems,
  };
}

export async function persistNarrativeArtifacts(
  supabase: {
    from: (table: string) => {
      upsert: (value: unknown, options?: { onConflict?: string }) => PromiseLike<{ error: { message: string } | null }>;
    };
  },
  input: BuildNarrativeInput
) {
  const artifacts = buildNarrativeArtifacts(input);

  const recapWrite = await supabase
    .from("match_round_recaps")
    .upsert(artifacts.roundRecap, { onConflict: "match_id,round_index" });
  if (recapWrite.error) {
    throw new Error(`Failed to persist round recap: ${recapWrite.error.message}`);
  }

  const newsWrite = await supabase
    .from("news_feed_items")
    .upsert(artifacts.newsItems, { onConflict: "match_id,story_key" });
  if (newsWrite.error) {
    throw new Error(`Failed to persist news feed items: ${newsWrite.error.message}`);
  }

  const inboxWrite = await supabase
    .from("inbox_messages")
    .upsert(artifacts.inboxMessages, { onConflict: "user_id,match_id,message_key" });
  if (inboxWrite.error) {
    throw new Error(`Failed to persist inbox messages: ${inboxWrite.error.message}`);
  }
}
