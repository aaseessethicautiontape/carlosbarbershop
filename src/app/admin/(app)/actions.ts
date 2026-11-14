"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/session";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { q } from "@/lib/db";
import { notify } from "@/lib/notify";
import { notifyNextInLine } from "@/lib/queue/next";
import type { ActionResult } from "@/lib/schemas/common";

/**
 * Staff actions. Each one: authorize() first (role re-checked here: the DB client bypasses RLS, so THIS is the gate),
 * Zod-parse the input, then run a parameterised query scoped to the staff member's own shop.
 */
const id = z.uuid();
const MSG: Record<string, string> = {
  barber_busy: "That barber is mid-cut or has a booking right now. Pick another chair.",
  barber_off: "That barber is off duty.",
  not_waiting: "That person is no longer in the line.",
};
const fail = (e: unknown): ActionResult => {
  const msg = e instanceof Error ? e.message : String(e);
  const key = Object.keys(MSG).find((k) => msg.includes(k));
  return { ok: false, error: key ? MSG[key]! : msg.includes("bookings_no_overlap") ? "That chair already has someone in it at that time." : "Something went wrong. Please try again." };
};

export async function setOnDutyAction(barberId: string, onDuty: boolean): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(barberId).success) return { ok: false, error: "Bad request." };
  try {
    await q("update barbers set on_duty = $2 where id = $1 and shop_id = $3", [barberId, onDuty, a.staff.profile.shop_id]);
  } catch (e) { return fail(e); }
  revalidateTag("barbers");
  await notifyNextInLine(a.staff.profile.shop_id);
  revalidatePath("/admin");
  return { ok: true };
}

const statusSchema = z.object({ bookingId: id, status: z.enum(["booked", "in_chair", "done", "no_show", "cancelled"]) });
export async function updateBookingStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  const p = statusSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Bad request." };
  try {
    await q("update bookings set status = $2::public.booking_status, cancelled_at = case when $2 = 'cancelled' then now() else cancelled_at end where id = $1 and shop_id = $3", [p.data.bookingId, p.data.status, a.staff.profile.shop_id]);
  } catch (e) { return fail(e); }
  await notifyNextInLine(a.staff.profile.shop_id);
  revalidatePath("/admin");
  return { ok: true };
}

export async function sendReminderAction(bookingId: string): Promise<ActionResult<{ note: string }>> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(bookingId).success) return { ok: false, error: "Bad request." };
  const view = await getBookingView(bookingId);
  if (!view || view.shopId !== a.staff.profile.shop_id) return { ok: false, error: "Booking not found." };
  const sent = await notify({ shopId: view.shopId, template: "reminder_24h", to: { email: view.clientEmail, phone: view.clientPhone }, data: messageDataFor(view), bookingId, manual: true });
  if (!sent.length) return { ok: false, error: "This client has no email or phone on file." };
  const r = sent[0]!;
  return r.status === "failed" ? { ok: false, error: r.error ?? "Couldn't send." } : { ok: true, note: r.status === "logged" ? `Reminder logged to the outbox (${r.channel}).` : `Reminder sent (${r.channel}).` };
}

export async function seatWalkinAction(walkinId: string, barberId: string): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(walkinId).success || !id.safeParse(barberId).success) return { ok: false, error: "Bad request." };
  const own = await q("select 1 from walkins where id = $1 and shop_id = $2", [walkinId, a.staff.profile.shop_id]);
  if (!own.length) return { ok: false, error: MSG.not_waiting! };
  try {
    await q("select public.seat_walkin($1::uuid, $2::uuid)", [walkinId, barberId]);
  } catch (e) { return fail(e); }
  await notifyNextInLine(a.staff.profile.shop_id);
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeWalkinAction(walkinId: string): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(walkinId).success) return { ok: false, error: "Bad request." };
  try {
    await q("update walkins set status = 'removed' where id = $1 and status = 'waiting' and shop_id = $2", [walkinId, a.staff.profile.shop_id]);
  } catch (e) { return fail(e); }
  await notifyNextInLine(a.staff.profile.shop_id);
  revalidatePath("/admin");
  return { ok: true };
}

const addSchema = z.object({ name: z.string().trim().min(1).max(60) });
export async function addWalkinAction(input: { name: string }): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Enter a name." };
  try {
    await q("insert into walkins (shop_id, display_name) values ($1, $2)", [a.staff.profile.shop_id, p.data.name]);
  } catch (e) { return fail(e); }
  revalidatePath("/admin");
  return { ok: true };
}
