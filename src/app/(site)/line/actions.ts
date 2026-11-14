"use server";
import { getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import { notifyNextInLine } from "@/lib/queue/next";
import { clientIp, intakeAllowed } from "@/lib/ratelimit";
import { tokenOnlySchema } from "@/lib/schemas/booking";
import { fieldErrors, type ActionResult } from "@/lib/schemas/common";
import { walkinSchema } from "@/lib/schemas/walkin";
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
  try {
    const [row] = await q<{ id: string }>("select public.join_walkin($1::uuid, $2::text, $3::text, $4::uuid) as id", [shop.id, parsed.data.name, parsed.data.phone, parsed.data.serviceId || null]);
    if (!row?.id) return { ok: false, error: "We couldn't add you to the line. Please try again." };
    await notifyNextInLine(shop.id);
    return { ok: true, token: signToken("walkin", row.id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
    return { ok: false, error: (key && MESSAGES[key]) || "We couldn't add you to the line. Please try again." };
  }
}

export async function leaveLineAction(formData: FormData): Promise<ActionResult> {
  const parsed = tokenOnlySchema.safeParse({ token: formData.get("token") });
  const t = parsed.success ? verifyToken(parsed.data.token, "walkin") : null;
  if (!t) return { ok: false, error: "This link isn't valid any more." };
  await q("update walkins set status = 'left' where id = $1::uuid and status = 'waiting'", [t.id]);
  const shop = await getShop();
  await notifyNextInLine(shop.id);
  return { ok: true };
}
