import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost/db");
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://example.neon.tech/neondb/auth");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "c".repeat(40));
  vi.stubEnv("NEON_REALTIME_URL", "https://example.rt.neon.tech/");
  vi.stubEnv("NEON_REALTIME_SECRET", "s".repeat(20));
  vi.stubEnv("APP_TOKEN_SECRET", "a-test-secret-that-is-definitely-long-enough-123");
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", "mock");
  vi.stubEnv("NEXT_PUBLIC_NEON_REALTIME_URL", "https://example.rt.neon.tech/");
});

describe("signed tokens", () => {
  it("round-trips an id for the right kind", async () => {
    const { signToken, verifyToken } = await import("./tokens");
    const t = signToken("booking", "abc-123");
    expect(verifyToken(t, "booking")).toEqual({ id: "abc-123" });
  });

  it("rejects the wrong kind (a booking link can't open a walk-in ticket)", async () => {
    const { signToken, verifyToken } = await import("./tokens");
    expect(verifyToken(signToken("booking", "abc"), "walkin")).toBeNull();
  });

  it("rejects tampering with the payload or the signature", async () => {
    const { signToken, verifyToken } = await import("./tokens");
    const [p, s] = signToken("booking", "abc").split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ k: "booking", id: "someone-else", exp: 9999999999 })).toString("base64url");
    expect(verifyToken(`${forged}.${s}`, "booking")).toBeNull();
    expect(verifyToken(`${p}.${s.slice(0, -2)}AA`, "booking")).toBeNull();
    expect(verifyToken("garbage", "booking")).toBeNull();
    expect(verifyToken("", "booking")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const { signToken, verifyToken } = await import("./tokens");
    expect(verifyToken(signToken("walkin", "abc", -5), "walkin")).toBeNull();
  });
});
