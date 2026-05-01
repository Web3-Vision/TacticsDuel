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

  it("rejects squad lock when tactics have not been saved", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "user-1",
              email: "manager@example.com",
              user_metadata: {},
            },
          },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    account_status: "active",
                    squad_locked: false,
                    ranked_matches_in_cycle: 0,
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "squads") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { player_ids: Array(11).fill("starter") },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "tactics") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    createServiceClientMock.mockResolvedValue({
      from: vi.fn(),
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          squad_locked: true,
        }),
      }) as never,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Save your tactics before locking the squad." });
  });
});
