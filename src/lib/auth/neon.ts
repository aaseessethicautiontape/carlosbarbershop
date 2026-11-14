import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";
import { serverEnv } from "@/lib/env.server";

let instance: ReturnType<typeof createNeonAuth> | undefined;

/** Managed Better Auth (Neon Auth). Sessions live in an encrypted cookie on this app's own origin. */
export function neonAuth() {
  const env = serverEnv();
  instance ??= createNeonAuth({ baseUrl: env.NEON_AUTH_BASE_URL, cookies: { secret: env.NEON_AUTH_COOKIE_SECRET } });
  return instance;
}
