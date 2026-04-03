import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();
const createSupabaseClientMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("supabase server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    });
  });

  it("creates a cookie-bound server client for authenticated requests", async () => {
    const { createClient } = await import("./server");

    await createClient();

    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("creates a stateless service-role client for admin writes", async () => {
    const { createServiceClient } = await import("./server");

    await createServiceClient();

    expect(createSupabaseClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(cookiesMock).not.toHaveBeenCalled();
  });
});
