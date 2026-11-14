"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { neonAuth } from "@/lib/auth/neon";
import { isMock } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { allow, clientIp } from "@/lib/ratelimit";
import type { ActionResult } from "@/lib/schemas/common";

/**
 * MOCK MODE ONLY. Signs in the seeded demo accounts (created by scripts/setup-demo-users.ts).
 * In live mode this action refuses, and the page doesn't render the buttons.
 */
export async function demoLoginAction(formData: FormData): Promise<ActionResult> {
  if (!isMock()) return { ok: false, error: "Demo login is disabled." };
  const who = z.enum(["owner", "barber"]).safeParse(formData.get("who"));
  if (!who.success) return { ok: false, error: "Unknown demo account." };
  const env = serverEnv();
  const email = who.data === "owner" ? env.DEMO_OWNER_EMAIL : env.DEMO_BARBER_EMAIL;
  if (!email || !env.DEMO_PASSWORD) return { ok: false, error: "Demo accounts aren't configured (DEMO_* env vars)." };
  const { error } = await neonAuth().signIn.email({ email, password: env.DEMO_PASSWORD });
  if (error) return { ok: false, error: "Demo accounts aren't set up. Run `pnpm demo:setup`." };
  redirect("/admin");
}

/** Staff sign-in with email + password (Neon Auth). Accounts are created by the owner in the Neon console. */
export async function passwordLoginAction(formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email().max(160), password: z.string().min(1).max(200) }).safeParse({ email: String(formData.get("email") ?? "").trim(), password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { ok: false, error: "Enter your email and password." };
  if (!(await allow(`login:${await clientIp()}`, 900, 10))) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  const { error } = await neonAuth().signIn.email(parsed.data);
  if (error) return { ok: false, error: "That email and password don't match." };
  redirect("/admin");
}

export async function signOutAction() {
  await neonAuth().signOut();
  redirect("/admin/login");
}
