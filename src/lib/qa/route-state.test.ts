import { describe, expect, it, vi } from "vitest";

import {
  getPlayQaFriendView,
  getPlayQaInviteCode,
  getPlayQaInviteMode,
} from "./route-state";

describe("QA route-state helpers", () => {
  it("ignores QA params when QA login is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "false");
    const searchParams = new URLSearchParams({
      qaFriendView: "join",
      qaInviteMode: "live_draft",
      qaInviteCode: "s107drp1",
    });

    expect(getPlayQaFriendView(searchParams)).toBeNull();
    expect(getPlayQaInviteMode(searchParams)).toBeNull();
    expect(getPlayQaInviteCode(searchParams)).toBeNull();
  });

  it("parses supported play QA params when QA login is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "true");
    const searchParams = new URLSearchParams({
      qaFriendView: "pending",
      qaInviteMode: "bring_squad",
      qaInviteCode: "s107sqd1",
    });

    expect(getPlayQaFriendView(searchParams)).toBe("pending");
    expect(getPlayQaInviteMode(searchParams)).toBe("bring_squad");
    expect(getPlayQaInviteCode(searchParams)).toBe("S107SQD1");
  });

  it("rejects unsupported values", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "true");
    const searchParams = new URLSearchParams({
      qaFriendView: "menu",
      qaInviteMode: "ranked",
    });

    expect(getPlayQaFriendView(searchParams)).toBeNull();
    expect(getPlayQaInviteMode(searchParams)).toBeNull();
  });
});
