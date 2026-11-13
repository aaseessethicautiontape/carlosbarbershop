import { z } from "zod";

/**
 * Environment, validated once. Public vars must be read with literal `process.env.NEXT_PUBLIC_*`
 * accesses so Next can inline them into the client bundle; server vars live in env.server.ts.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_MODE: z.enum(["mock", "live"]).default("mock"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid public environment. Copy .env.example to .env.local and fill it in (mock mode: ./scripts/print-local-env.sh > .env.local).\n" +
        z.prettifyError(parsed.error),
    );
  }
  cached = parsed.data;
  return cached;
}

export const isMock = () => publicEnv().NEXT_PUBLIC_APP_MODE === "mock";
export const isLive = () => !isMock();
