import { describe, expect, it, vi } from "vitest";

import {
  getDraftQaState,
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
      qaState: "reconnecting",
    });

    expect(getPlayQaFriendView(searchParams)).toBeNull();
    expect(getPlayQaInviteMode(searchParams)).toBeNull();
    expect(getPlayQaInviteCode(searchParams)).toBeNull();
    expect(getDraftQaState(searchParams)).toBeNull();
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

  it("parses loading draft QA state override", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "true");
    const searchParams = new URLSearchParams({ qaState: "loading" });

    expect(getDraftQaState(searchParams)).toBe("loading");
  });

  it("parses reconnecting draft QA state override", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "true");
    const searchParams = new URLSearchParams({ qaState: "reconnecting" });

    expect(getDraftQaState(searchParams)).toBe("reconnecting");
  });

  it("rejects unsupported values", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_PASSWORD_LOGIN", "true");
    const searchParams = new URLSearchParams({
      qaFriendView: "menu",
      qaInviteMode: "ranked",
      qaState: "error",
    });

    expect(getPlayQaFriendView(searchParams)).toBeNull();
    expect(getPlayQaInviteMode(searchParams)).toBeNull();
    expect(getDraftQaState(searchParams)).toBeNull();
  });
});
