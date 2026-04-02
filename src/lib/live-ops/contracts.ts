export interface CadenceSnapshot {
  generatedAt: string;
  dailyResetAt: string;
  weeklyResetAt: string;
  seasonEndsAt: string | null;
}

export interface MissionContractRow {
  id: string;
  mission_type: string;
  mission_key?: string;
  description: string;
  target: number;
  progress: number;
  reward_coins: number;
  expires_at: string | null;
  claimed: boolean;
  is_featured?: boolean;
  recommended_mode?: string | null;
  priority_weight?: number;
  created_at?: string;
}

export interface FeedContractRow {
  id: string;
  title: string;
  body?: string | null;
  summary?: string | null;
  created_at: string;
}

export interface LiveOpsEventCard {
  id: string;
  category: "special_queue" | "tournament_window" | "promoted_event";
  title: string;
  summary: string;
  startsAt: string | null;
  endsAt: string | null;
  entryHref: string;
  priority: number;
}

export interface MissionInsertMetadata {
  is_featured: boolean;
  recommended_mode: string | null;
  priority_weight: number;
}

export function getCadenceSnapshot(now: Date = new Date(), seasonEndsAt: string | null = null): CadenceSnapshot {
  const dailyResetAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ));

  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const weeklyResetAt = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    0,
    0,
    0,
    0,
  ));

  return {
    generatedAt: now.toISOString(),
    dailyResetAt: dailyResetAt.toISOString(),
    weeklyResetAt: weeklyResetAt.toISOString(),
    seasonEndsAt,
  };
}

export function getMissionInsertMetadata(
  missionType: string,
  missionKey: string,
  index: number,
): MissionInsertMetadata {
  const recommendedMode = missionKey.includes("ranked")
    ? "ranked"
    : missionKey.includes("play_any")
      ? "any"
      : null;
  const baseWeight = missionType === "weekly" ? 70 : 40;

  return {
    is_featured: index === 0,
    recommended_mode: recommendedMode,
    priority_weight: Math.max(10, baseWeight - (index * 5)),
  };
}

export function sortMissionRows(missions: MissionContractRow[]): MissionContractRow[] {
  return [...missions].sort((a, b) => {
    const featuredOrder = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
    if (featuredOrder !== 0) return featuredOrder;

    const weightOrder = (b.priority_weight ?? 0) - (a.priority_weight ?? 0);
    if (weightOrder !== 0) return weightOrder;

    const typeOrder = a.mission_type.localeCompare(b.mission_type);
    if (typeOrder !== 0) return typeOrder;

    const aProgress = a.target <= 0 ? 0 : a.progress / a.target;
    const bProgress = b.target <= 0 ? 0 : b.progress / b.target;
    if (bProgress !== aProgress) return bProgress - aProgress;

    const aExpiry = a.expires_at ? Date.parse(a.expires_at) : Number.MAX_SAFE_INTEGER;
    const bExpiry = b.expires_at ? Date.parse(b.expires_at) : Number.MAX_SAFE_INTEGER;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;

    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

export function decodeOffsetCursor(cursor: string | null): number {
  if (!cursor) return 0;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown };
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? Math.floor(parsed.offset) : 0;
  } catch {
    return 0;
  }
}

export function buildLiveOpsEventCards(input: {
  now: Date;
  cadence: CadenceSnapshot;
  missions: MissionContractRow[];
  inbox: FeedContractRow[];
  news: FeedContractRow[];
}): LiveOpsEventCard[] {
  const cards: LiveOpsEventCard[] = [
    {
      id: "ranked-queue",
      category: "special_queue",
      title: "Ranked Queue Window",
      summary: "Jump into ranked fixtures and push your ladder position before the weekly rotation closes.",
      startsAt: input.now.toISOString(),
      endsAt: input.cadence.weeklyResetAt,
      entryHref: "/play",
      priority: 100,
    },
    {
      id: "weekly-rotation",
      category: "tournament_window",
      title: "Weekly Rotation",
      summary: "Live ops rotates weekly objectives and featured pressure windows on a single backend cadence.",
      startsAt: input.cadence.generatedAt,
      endsAt: input.cadence.weeklyResetAt,
      entryHref: "/missions",
      priority: 80,
    },
  ];

  const featuredMission = sortMissionRows(input.missions).find((mission) => !mission.claimed) ?? null;
  if (featuredMission) {
    cards.push({
      id: `mission-${featuredMission.id}`,
      category: "promoted_event",
      title: featuredMission.is_featured ? "Featured Mission" : "Mission Push",
      summary: `${featuredMission.description} · +${featuredMission.reward_coins} coins`,
      startsAt: featuredMission.created_at ?? input.cadence.generatedAt,
      endsAt: featuredMission.expires_at,
      entryHref: "/missions",
      priority: 90 + (featuredMission.priority_weight ?? 0),
    });
  }

  const spotlight = input.news[0] ?? input.inbox[0] ?? null;
  if (spotlight) {
    cards.push({
      id: `spotlight-${spotlight.id}`,
      category: "promoted_event",
      title: spotlight.title,
      summary: spotlight.summary ?? spotlight.body ?? "Latest live ops update",
      startsAt: spotlight.created_at,
      endsAt: input.cadence.dailyResetAt,
      entryHref: input.news[0]?.id === spotlight.id ? "/news" : "/inbox",
      priority: 70,
    });
  }

  return cards.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}
