import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/lib/profile-options", () => ({
  ACCOUNT_STATUSES: ["active", "paused", "deactivated"],
  MANAGER_ARCHETYPES: ["tactician"],
  HAIR_STYLES: ["short"],
  HAIR_COLORS: ["brown"],
  SKIN_TONES: ["medium"],
  BEARD_STYLES: ["clean-shaven"],
}));

describe("/api/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bootstraps a missing profile before applying onboarding updates", async () => {
    const maybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "user-1" }, error: null });
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const eqMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "user-1",
              email: "manager@example.com",
              user_metadata: {
                username: "ManagerOne",
                club_name: "Manager One FC",
              },
            },
          },
        }),
      },
      from: fromMock,
    });

    createServiceClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manager_name: "Manager One",
          onboarding_completed: false,
        }),
      }) as never,
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: "user-1",
        username: "ManagerOne_user-1",
        club_name: "Manager One FC",
      },
      { onConflict: "id" },
    );
  });
});
