import "server-only";
import { neon } from "@neondatabase/serverless";
import { serverEnv } from "@/lib/env.server";

/**
 * The ONE database client. Neon Postgres over HTTP (works on Vercel and locally), using the owner
 * connection string in DATABASE_URL, a server-only secret. Because it bypasses RLS, every caller must
 * have validated input with Zod and (for admin work) passed authorize() first. All values go through
 * numbered parameters ($1, $2 ...). Never build SQL by string concatenation.
 */
let client: ReturnType<typeof neon> | undefined;

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  client ??= neon(serverEnv().DATABASE_URL);
  return (await client.query(text, params as never[])) as unknown as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}

/** timestamptz values may arrive as Date or string depending on the driver; always give back an ISO string. */
export const iso = (v: unknown): string => (v instanceof Date ? v : new Date(String(v))).toISOString();
