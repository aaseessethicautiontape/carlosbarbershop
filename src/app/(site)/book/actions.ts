"use server";
import { loadSlots } from "@/lib/availability/load";
import { localDay, isDay } from "@/lib/availability/tz";
import { pickBarber } from "@/lib/availability/slots";
import { getBarbers, getShop } from "@/lib/data/public";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { notify } from "@/lib/notify";
import { clientIp, intakeAllowed } from "@/lib/ratelimit";
import { bookingSchema, rescheduleSchema, tokenOnlySchema } from "@/lib/schemas/booking";
import { fieldErrors, type ActionResult } from "@/lib/schemas/common";
import { adminClient } from "@/lib/supabase/admin";
import { HONEYPOT_FIELD, honeypotTripped, verifyTurnstile } from "@/lib/turnstile";
import { signToken, verifyToken } from "@/lib/tokens";
import { revalidatePath } from "next/cache";

const MESSAGES: Record<string, string> = {
  slot_taken: "Someone just grabbed that time. Please pick another.",
  too_soon: "That time is too soon to book online. Please pick a later one, or join the walk-in line.",
  too_far: "That's further ahead than we take bookings.",
  outside_hours: "We're not open then. Please pick another time.",
  barber_off: "That barber isn't working then. Please pick another time or barber.",
  barber_service_mismatch: "That barber doesn't do that service. Please pick another barber.",
  service_unavailable: "That service isn't available online right now.",
  not_reschedulable: "This booking can't be changed any more.",
};
const friendly = (msg: string | undefined) => MESSAGES[msg ?? ""] ?? "We couldn't book that. Please try again.";

export async function createBookingAction(formData: FormData): Promise<ActionResult<{ token: string }>> {
  // 1. Bots: the honeypot is hidden from people. Pretend it worked so they learn nothing.
  if (honeypotTripped(formData)) return { ok: true, token: "invalid" };

  // 2. Validate everything with Zod.
  const raw = Object.fromEntries([...formData.entries()].filter(([k]) => k !== HONEYPOT_FIELD && k !== "cf-turnstile-response"));
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };
  const input = parsed.data;

  // 3. Turnstile (stubbed in mock mode) and rate limits (IP + phone).
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), await clientIp()))) return { ok: false, error: "Please complete the human check and try again." };
  if (!(await intakeAllowed("booking", input.phone))) return { ok: false, error: "Too many attempts. Please wait a few minutes or call the shop." };

  const shop = await getShop();
  const day = localDay(new Date(input.startsAt), shop.timezone);
  if (!isDay(day)) return { ok: false, error: "Bad date." };

  // 4. The time must be a real open slot (grid-aligned, free right now).
  const { slots, busy } = await loadSlots({ serviceId: input.serviceId, barberId: input.barberId, day });
  const slot = slots.find((s) => s.start === new Date(input.startsAt).toISOString());
  if (!slot) return { ok: false, error: friendly("slot_taken") };

  // 5. "Any barber": try the least-busy free barber first, fall through on a lost race.
  let candidates = slot.barberIds;
  if (input.barberId === "any") {
    const first = pickBarber(candidates, busy, day, shop.timezone);
    candidates = first ? [first, ...candidates.filter((c) => c !== first)] : candidates;
  } else candidates = candidates.filter((c) => c === input.barberId);

  const db = adminClient();
  let bookingId: string | null = null;
  let lastError: string | undefined;
  for (const barberId of candidates) {
    const { data, error } = await db.rpc("create_booking", {
      p_shop: shop.id, p_barber: barberId, p_service: input.serviceId, p_starts: new Date(input.startsAt).toISOString(),
      p_name: input.name, p_phone: input.phone, p_email: input.email || undefined,
    });
    if (!error && data) { bookingId = data; break; }
    lastError = error?.message;
    if (lastError !== "slot_taken") break; // only retry the next barber on a race
  }
  if (!bookingId) return { ok: false, error: friendly(lastError) };

  // 6. Confirmation (never blocks the booking if messaging hiccups).
  try {
    const view = await getBookingView(bookingId);
    if (view) await notify({ shopId: shop.id, template: "confirmation", to: { email: view.clientEmail, phone: view.clientPhone }, data: messageDataFor(view), bookingId });
  } catch (e) {
    console.error("confirmation notify failed", e);
  }
  return { ok: true, token: signToken("booking", bookingId) };
}

export async function cancelBookingAction(formData: FormData): Promise<ActionResult> {
  const parsed = tokenOnlySchema.safeParse({ token: formData.get("token") });
  const t = parsed.success ? verifyToken(parsed.data.token, "booking") : null;
  if (!t) return { ok: false, error: "This link isn't valid any more." };
  const { data, error } = await adminClient().from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", t.id).eq("status", "booked").gt("starts_at", new Date().toISOString()).select("id");
  if (error || !data?.length) return { ok: false, error: "This booking can't be cancelled online. Please call the shop." };
  revalidatePath(`/b/${parsed.data!.token}`);
  return { ok: true };
}

export async function rescheduleBookingAction(input: { token: string; startsAt: string }): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  const t = parsed.success ? verifyToken(parsed.data.token, "booking") : null;
  if (!parsed.success || !t) return { ok: false, error: "This link isn't valid any more." };
  const view = await getBookingView(t.id);
  if (!view || !view.canChange) return { ok: false, error: friendly("not_reschedulable") };

  const shop = await getShop();
  const day = localDay(new Date(parsed.data.startsAt), shop.timezone);
  const { slots } = await loadSlots({ serviceId: view.serviceId, barberId: view.barberId, day });
  // Allow the booking's own current time too (it occupies the slot being moved from).
  if (!slots.some((s) => s.start === new Date(parsed.data.startsAt).toISOString())) return { ok: false, error: friendly("slot_taken") };

  const { error } = await adminClient().rpc("reschedule_booking", { p_booking: t.id, p_starts: new Date(parsed.data.startsAt).toISOString() });
  if (error) return { ok: false, error: friendly(error.message) };
  try {
    const fresh = await getBookingView(t.id);
    if (fresh) await notify({ shopId: shop.id, template: "confirmation", to: { email: fresh.clientEmail, phone: fresh.clientPhone }, data: messageDataFor(fresh), bookingId: t.id });
  } catch (e) { console.error(e); }
  revalidatePath(`/b/${parsed.data.token}`);
  return { ok: true };
}
