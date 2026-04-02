export type PlayQaFriendView = "create" | "join" | "pending";
type SearchParamReader = Pick<URLSearchParams, "get">;

function isQaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN === "true";
}

function normalizeValue(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getPlayQaFriendView(searchParams: SearchParamReader): PlayQaFriendView | null {
  if (!isQaEnabled()) return null;

  const value = normalizeValue(searchParams.get("qaFriendView"));
  if (value === "create" || value === "join" || value === "pending") {
    return value;
  }

  return null;
}

export function getPlayQaInviteMode(searchParams: SearchParamReader): "bring_squad" | "live_draft" | null {
  if (!isQaEnabled()) return null;

  const value = normalizeValue(searchParams.get("qaInviteMode"));
  if (value === "bring_squad" || value === "live_draft") {
    return value;
  }

  return null;
}

export function getPlayQaInviteCode(searchParams: SearchParamReader): string | null {
  if (!isQaEnabled()) return null;

  const value = normalizeValue(searchParams.get("qaInviteCode"));
  return value ? value.toUpperCase() : null;
}
