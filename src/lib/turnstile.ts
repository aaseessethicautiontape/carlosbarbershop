import "server-only";
import { isMock } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/** Cloudflare Turnstile server check. Mock mode: always passes (the widget is replaced by a dummy field). */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (isMock()) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: serverEnv().TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

/** Honeypot: a hidden field real people never fill. A bot that does gets a fake "success". */
export const HONEYPOT_FIELD = "website";
export const honeypotTripped = (fd: FormData) => String(fd.get(HONEYPOT_FIELD) ?? "").trim() !== "";
