"use server";
import { revalidatePath } from "next/cache";
import { loadSlots } from "@/lib/availability/load";
import { pickBarber } from "@/lib/availability/slots";
import { isDay, localDay } from "@/lib/availability/tz";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import { notify } from "@/lib/notify";
import { clientIp, intakeAllowed } from "@/lib/ratelimit";
import { bookingSchema, rescheduleSchema, tokenOnlySchema } from "@/lib/schemas/booking";
import { fieldErrors, type ActionResult } from "@/lib/schemas/common";
import { signToken, verifyToken } from "@/lib/tokens";
import { HONEYPOT_FIELD, honeypotTripped, verifyTurnstile } from "@/lib/turnstile";

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
/** Database functions raise named errors (e.g. `slot_taken`). Find which one the driver message contains. */
const dbError = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  return Object.keys(MESSAGES).find((k) => msg.includes(k)) ?? "";
};
const friendly = (key: string) => MESSAGES[key] ?? "We couldn't book that. Please try again.";

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

  let bookingId: string | null = null;
  let lastError = "";
  for (const barberId of candidates) {
    try {
      const [row] = await q<{ id: string }>(
        "select public.create_booking($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5::text, $6::text, $7::text, 'web'::public.booking_source, null::text) as id",
        [shop.id, barberId, input.serviceId, new Date(input.startsAt).toISOString(), input.name, input.phone, input.email || null],
      );
      if (row?.id) { bookingId = row.id; break; }
    } catch (e) {
      lastError = dbError(e);
      if (lastError !== "slot_taken") break; // only retry the next barber on a race
    }
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
  const rows = await q<{ id: string }>("update bookings set status = 'cancelled', cancelled_at = now() where id = $1::uuid and status = 'booked' and starts_at > now() returning id", [t.id]);
  if (!rows.length) return { ok: false, error: "This booking can't be cancelled online. Please call the shop." };
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
  if (!slots.some((s) => s.start === new Date(parsed.data.startsAt).toISOString())) return { ok: false, error: friendly("slot_taken") };

  try {
    await q("select public.reschedule_booking($1::uuid, $2::timestamptz, null::uuid)", [t.id, new Date(parsed.data.startsAt).toISOString()]);
  } catch (e) {
    return { ok: false, error: friendly(dbError(e)) };
  }
  try {
    const fresh = await getBookingView(t.id);
    if (fresh) await notify({ shopId: shop.id, template: "confirmation", to: { email: fresh.clientEmail, phone: fresh.clientPhone }, data: messageDataFor(fresh), bookingId: t.id });
  } catch (e) { console.error(e); }
  revalidatePath(`/b/${parsed.data.token}`);
  return { ok: true };
}
