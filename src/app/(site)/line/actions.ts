"use server";
import { notifyNextInLine } from "@/lib/queue/next";
import { clientIp, intakeAllowed } from "@/lib/ratelimit";
import { fieldErrors, type ActionResult } from "@/lib/schemas/common";
import { tokenOnlySchema } from "@/lib/schemas/booking";
import { walkinSchema } from "@/lib/schemas/walkin";
import { getShop } from "@/lib/data/public";
import { adminClient } from "@/lib/supabase/admin";
import { signToken, verifyToken } from "@/lib/tokens";
import { HONEYPOT_FIELD, honeypotTripped, verifyTurnstile } from "@/lib/turnstile";

const MESSAGES: Record<string, string> = {
  closed: "We're closed right now, so the line isn't open. You can book a time instead.",
  queue_full: "The line is full right now. Please call the shop or try again soon.",
  no_barbers: "No barbers are on right now. Please check back soon or book a time.",
};

export async function joinLineAction(formData: FormData): Promise<ActionResult<{ token: string }>> {
  if (honeypotTripped(formData)) return { ok: true, token: "invalid" };
  const raw = Object.fromEntries([...formData.entries()].filter(([k]) => k !== HONEYPOT_FIELD && k !== "cf-turnstile-response"));
  const parsed = walkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };

  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), await clientIp()))) return { ok: false, error: "Please complete the human check and try again." };
  if (!(await intakeAllowed("walkin", parsed.data.phone))) return { ok: false, error: "Too many attempts. Please wait a few minutes or ask at the shop." };

  const shop = await getShop();
  const { data, error } = await adminClient().rpc("join_walkin", { p_shop: shop.id, p_name: parsed.data.name, p_phone: parsed.data.phone, p_service: parsed.data.serviceId || undefined });
  if (error || !data) return { ok: false, error: MESSAGES[error?.message ?? ""] ?? "We couldn't add you to the line. Please try again." };
  await notifyNextInLine(shop.id);
  return { ok: true, token: signToken("walkin", data) };
}

export async function leaveLineAction(formData: FormData): Promise<ActionResult> {
  const parsed = tokenOnlySchema.safeParse({ token: formData.get("token") });
  const t = parsed.success ? verifyToken(parsed.data.token, "walkin") : null;
  if (!t) return { ok: false, error: "This link isn't valid any more." };
  const { error } = await adminClient().from("walkins").update({ status: "left" }).eq("id", t.id).eq("status", "waiting");
  if (error) return { ok: false, error: "Couldn't update the line. Please tell the front desk." };
  const shop = await getShop();
  await notifyNextInLine(shop.id);
  return { ok: true };
}
