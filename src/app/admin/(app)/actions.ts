"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/session";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { notify } from "@/lib/notify";
import { notifyNextInLine } from "@/lib/queue/next";
import type { ActionResult } from "@/lib/schemas/common";
import { userClient } from "@/lib/supabase/server";

/**
 * Staff actions. Each one: authorize() first (role re-checked here, not just in middleware),
 * Zod-parse the input, then write through the signed-in user's client so RLS still applies.
 */
const id = z.uuid();
const MSG: Record<string, string> = {
  barber_busy: "That barber is mid-cut or has a booking right now. Pick another chair.",
  barber_off: "That barber is off duty.",
  not_waiting: "That person is no longer in the line.",
  forbidden: "You don't have access to do that.",
};
const fail = (e?: string): ActionResult => ({ ok: false, error: MSG[e ?? ""] ?? "Something went wrong. Please try again." });

export async function setOnDutyAction(barberId: string, onDuty: boolean): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(barberId).success) return { ok: false, error: "Bad request." };
  const db = await userClient();
  const { error } = await db.from("barbers").update({ on_duty: onDuty }).eq("id", barberId);
  if (error) return fail(error.message);
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
  const db = await userClient();
  const patch = p.data.status === "cancelled" ? { status: p.data.status, cancelled_at: new Date().toISOString() } : { status: p.data.status };
  const { error } = await db.from("bookings").update(patch).eq("id", p.data.bookingId);
  if (error) return error.code === "23P01" ? { ok: false, error: "That chair already has someone in it at that time." } : fail(error.message);
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
  const db = await userClient();
  const { error } = await db.rpc("seat_walkin", { p_walkin: walkinId, p_barber: barberId });
  if (error) return fail(error.message);
  await notifyNextInLine(a.staff.profile.shop_id);
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeWalkinAction(walkinId: string): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  if (!id.safeParse(walkinId).success) return { ok: false, error: "Bad request." };
  const db = await userClient();
  const { error } = await db.from("walkins").update({ status: "removed" }).eq("id", walkinId).eq("status", "waiting");
  if (error) return fail(error.message);
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
  const db = await userClient();
  const { error } = await db.from("walkins").insert({ shop_id: a.staff.profile.shop_id, display_name: p.data.name });
  if (error) return fail(error.message);
  revalidatePath("/admin");
  return { ok: true };
}
