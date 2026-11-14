import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { q } from "@/lib/db";

/** Hash identifiers before they touch the rate_limits table so it never stores raw IPs or phone numbers. */
const h = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 24);

export async function clientIp(): Promise<string> {
  const hdrs = await headers();
  return (hdrs.get("x-forwarded-for")?.split(",")[0] ?? hdrs.get("x-real-ip") ?? "unknown").trim();
}

/** Returns true when allowed. Fails CLOSED: if the limiter errors, the request is refused. */
export async function allow(key: string, windowSeconds: number, max: number): Promise<boolean> {
  try {
    const rows = await q<{ ok: boolean }>("select public.hit_rate_limit($1, $2::int, $3::int) as ok", [key, windowSeconds, max]);
    return rows[0]?.ok === true;
  } catch (e) {
    console.error("rate limiter error", e instanceof Error ? e.message : e);
    return false;
  }
}

/** IP + phone limits for public intake endpoints. */
export async function intakeAllowed(scope: "booking" | "walkin", phone: string): Promise<boolean> {
  const ip = await clientIp();
  const perIp = scope === "booking" ? { window: 600, max: 10 } : { window: 600, max: 8 };
  const perPhone = scope === "booking" ? { window: 3600, max: 5 } : { window: 3600, max: 4 };
  const [a, b] = await Promise.all([allow(`${scope}:ip:${h(ip)}`, perIp.window, perIp.max), allow(`${scope}:phone:${h(phone)}`, perPhone.window, perPhone.max)]);
  return a && b;
}
