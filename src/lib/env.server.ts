import "server-only";
import { z } from "zod";
import { publicEnv } from "./env";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_TOKEN_SECRET: z.string().min(32, "APP_TOKEN_SECRET must be at least 32 characters (openssl rand -base64 48)"),
  CRON_SECRET: z.string().min(16).optional(),
  DEMO_OWNER_EMAIL: z.string().optional(),
  DEMO_OWNER_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFY_FROM_EMAIL: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.keys(serverSchema.shape).map((k) => [k, process.env[k] || undefined]));
  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid server environment.\n" + z.prettifyError(parsed.error));
  const env = parsed.data;

  // Live mode needs the real services. Fail loudly at first use rather than silently dropping emails.
  if (publicEnv().NEXT_PUBLIC_APP_MODE === "live") {
    const missing = (["RESEND_API_KEY", "NOTIFY_FROM_EMAIL", "TURNSTILE_SECRET_KEY", "CRON_SECRET"] as const).filter((k) => !env[k]);
    if (!publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY) missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY" as never);
    if (missing.length) throw new Error(`Live mode is missing: ${missing.join(", ")}. See README.md → "Switching to live".`);
  }
  cached = env;
  return env;
}
