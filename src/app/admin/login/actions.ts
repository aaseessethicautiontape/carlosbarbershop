"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isMock, publicEnv } from "@/lib/env";
import { allow, clientIp } from "@/lib/ratelimit";
import { userClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/schemas/common";

/**
 * MOCK MODE ONLY. Signs in the seeded local demo accounts. In live mode this action refuses,
 * and the page doesn't render the button.
 */
export async function demoLoginAction(formData: FormData): Promise<ActionResult> {
  if (!isMock()) return { ok: false, error: "Demo login is disabled." };
  const who = z.enum(["owner", "barber"]).safeParse(formData.get("who"));
  if (!who.success) return { ok: false, error: "Unknown demo account." };
  const email = who.data === "owner" ? "owner@carlos.test" : "barber@carlos.test";
  const db = await userClient();
  const { error } = await db.auth.signInWithPassword({ email, password: process.env.DEMO_OWNER_PASSWORD || "demo-pass-123" });
  if (error) return { ok: false, error: "Demo accounts aren't set up. Run `pnpm db:reset`." };
  redirect("/admin");
}

/** Live mode: passwordless magic link. Only existing staff can receive one (signups are disabled). */
export async function magicLinkAction(formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email().max(160) }).safeParse({ email: String(formData.get("email") ?? "").trim() });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  if (!(await allow(`login:${await clientIp()}`, 900, 6))) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  const db = await userClient();
  await db.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/admin/auth/callback` } });
  // Same answer whether or not the address is a staff member: don't leak who is on the team.
  return { ok: true };
}

export async function signOutAction() {
  const db = await userClient();
  await db.auth.signOut();
  redirect("/admin/login");
}
