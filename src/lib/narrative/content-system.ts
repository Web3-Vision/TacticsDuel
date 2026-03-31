export type NarrativeChannel = "inbox" | "news" | "round_recap";
export type NarrativeTone = "positive" | "neutral" | "negative";

export interface NarrativeMatchPayload {
  id: string;
  home_user_id: string;
  away_user_id: string | null;
  home_score: number | null;
  away_score: number | null;
  match_type: string;
  completed_at: string | null;
  home_elo_change?: number | null;
  away_elo_change?: number | null;
}

export interface NarrativeItem {
  id: string;
  channel: NarrativeChannel;
  title: string;
  body: string;
  occurredAt: string;
  tone: NarrativeTone;
  ctaLabel?: string;
  ctaHref?: string;
  tags: string[];
}

interface BuildNarrativeInput {
  userId: string;
  matches: NarrativeMatchPayload[];
  clubNameByUserId?: Record<string, string>;
}

interface NarrativeBundle {
  inbox: NarrativeItem[];
  news: NarrativeItem[];
  roundRecap: NarrativeItem[];
}

export interface InboxMessagePayload {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface NewsFeedPayload {
  id: string;
  title: string;
  summary: string;
  created_at: string;
}

export interface RoundRecapPayload {
  id: string;
  recap: {
    matchType?: string;
    scoreline?: { home?: number; away?: number };
    keyMoments?: Array<{ minute?: number; description?: string }>;
  } | null;
  created_at: string;
}

function byRecent(a: NarrativeItem, b: NarrativeItem): number {
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
}

function formatOutcome(scoreFor: number, scoreAgainst: number): {
  result: "W" | "D" | "L";
  tone: NarrativeTone;
} {
  if (scoreFor > scoreAgainst) {
    return { result: "W", tone: "positive" };
  }
  if (scoreFor < scoreAgainst) {
    return { result: "L", tone: "negative" };
  }
  return { result: "D", tone: "neutral" };
}

function safeScore(value: number | null): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

export function buildNarrativeContent(input: BuildNarrativeInput): NarrativeBundle {
  const matches = [...input.matches]
    .filter((m) => Boolean(m.completed_at))
    .sort((a, b) => new Date(b.completed_at as string).getTime() - new Date(a.completed_at as string).getTime());

  const inbox: NarrativeItem[] = [];
  const news: NarrativeItem[] = [];
  const roundRecap: NarrativeItem[] = [];

  for (const match of matches) {
    const isHome = match.home_user_id === input.userId;
    const myScore = safeScore(isHome ? match.home_score : match.away_score);
    const oppScore = safeScore(isHome ? match.away_score : match.home_score);
    const { result, tone } = formatOutcome(myScore, oppScore);
    const opponentId = isHome ? match.away_user_id : match.home_user_id;
    const opponentClub = (opponentId && input.clubNameByUserId?.[opponentId]) || "Rival Club";
    const eloDelta = isHome ? match.home_elo_change : match.away_elo_change;
    const occurredAt = match.completed_at as string;

    roundRecap.push({
      id: `${match.id}-recap`,
      channel: "round_recap",
      title: `${result} vs ${opponentClub}`,
      body: `${myScore}-${oppScore} in ${match.match_type.toUpperCase()} play.`,
      occurredAt,
      tone,
      ctaLabel: "Replay",
      ctaHref: `/match/${match.id}`,
      tags: [match.match_type, "round"],
    });

    news.push({
      id: `${match.id}-news`,
      channel: "news",
      title: `Division wire: ${opponentClub} clash settled`,
      body: `Final score ${myScore}-${oppScore}. ${result === "W" ? "Three points secured." : result === "L" ? "Points dropped this round." : "Points shared in a tight fixture."}`,
      occurredAt,
      tone: "neutral",
      ctaLabel: "Open History",
      ctaHref: "/history",
      tags: ["division", "results"],
    });

    inbox.push({
      id: `${match.id}-inbox`,
      channel: "inbox",
      title:
        result === "W"
          ? "Performance memo: momentum gained"
          : result === "L"
            ? "Performance memo: review needed"
            : "Performance memo: margins are thin",
      body:
        eloDelta == null
          ? `Latest result ${myScore}-${oppScore} vs ${opponentClub}.`
          : `Latest result ${myScore}-${oppScore} vs ${opponentClub}. ELO ${eloDelta > 0 ? "+" : ""}${eloDelta}.`,
      occurredAt,
      tone,
      ctaLabel: "Open Match",
      ctaHref: `/match/${match.id}`,
      tags: ["performance", "matchday"],
    });
  }

  if (roundRecap.length === 0) {
    const nowIso = new Date().toISOString();
    roundRecap.push({
      id: "round-empty",
      channel: "round_recap",
      title: "No round recap yet",
      body: "Play your next match to generate a live recap card.",
      occurredAt: nowIso,
      tone: "neutral",
      ctaLabel: "Queue Match",
      ctaHref: "/play",
      tags: ["setup"],
    });
    news.push({
      id: "news-empty",
      channel: "news",
      title: "Wire standby",
      body: "News updates appear after your first completed fixture.",
      occurredAt: nowIso,
      tone: "neutral",
      ctaLabel: "Go Play",
      ctaHref: "/play",
      tags: ["setup"],
    });
    inbox.push({
      id: "inbox-empty",
      channel: "inbox",
      title: "Inbox clear",
      body: "No tactical memos yet. Complete a match to populate your inbox.",
      occurredAt: nowIso,
      tone: "neutral",
      ctaLabel: "Start Match",
      ctaHref: "/play",
      tags: ["setup"],
    });
  }

  return {
    inbox: inbox.sort(byRecent),
    news: news.sort(byRecent),
    roundRecap: roundRecap.sort(byRecent),
  };
}

export function buildNarrativeContentFromPersistence(input: {
  inboxRows: InboxMessagePayload[];
  newsRows: NewsFeedPayload[];
  recapRows: RoundRecapPayload[];
}): NarrativeBundle {
  const inbox: NarrativeItem[] = input.inboxRows.map((row) => ({
    id: row.id,
    channel: "inbox",
    title: row.title,
    body: row.body,
    occurredAt: row.created_at,
    tone: row.title.toLowerCase().includes("defeat") ? "negative" : row.title.toLowerCase().includes("victory") ? "positive" : "neutral",
    tags: ["inbox", "matchday"],
  }));

  const news: NarrativeItem[] = input.newsRows.map((row) => ({
    id: row.id,
    channel: "news",
    title: row.title,
    body: row.summary,
    occurredAt: row.created_at,
    tone: "neutral",
    tags: ["news", "wire"],
  }));

  const roundRecap: NarrativeItem[] = input.recapRows.map((row) => {
    const home = row.recap?.scoreline?.home ?? 0;
    const away = row.recap?.scoreline?.away ?? 0;
    const keyMoments = row.recap?.keyMoments?.length ?? 0;
    const matchType = (row.recap?.matchType ?? "match").toUpperCase();

    return {
      id: row.id,
      channel: "round_recap",
      title: `${matchType} recap ${home}-${away}`,
      body: `${keyMoments} key moments persisted for replay-safe recap.`,
      occurredAt: row.created_at,
      tone: "neutral",
      tags: ["round", "recap"],
      ctaLabel: "Open History",
      ctaHref: "/history",
    };
  });

  return {
    inbox: inbox.sort(byRecent),
    news: news.sort(byRecent),
    roundRecap: roundRecap.sort(byRecent),
  };
}
