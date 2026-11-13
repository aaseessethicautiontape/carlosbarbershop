"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { addDays, isDay, zoned } from "@/lib/availability/tz";
import { authorize } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { initials as makeInitials } from "@/lib/format";
import type { ActionResult } from "@/lib/schemas/common";
import { userClient } from "@/lib/supabase/server";

/** Owner-only configuration. authorize(["owner"]) first, then Zod, then the owner's own client (RLS re-checks). */
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const db = userClient;
const bad = (m = "Please check the fields and try again."): ActionResult => ({ ok: false, error: m });
const dollars = z.string().trim().regex(/^(\d{1,4}(\.\d{1,2})?)?$/, "Price looks like 35 or 35.50").transform((s) => (s === "" ? null : Math.round(Number(s) * 100)));

// ---------------------------------------------------------------- services
const serviceSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(100), price: dollars,
  durationMinutes: z.coerce.number().int().min(5).max(240), durationLabel: z.string().trim().max(40), showOnline: z.boolean(),
});

export async function updateServiceAction(input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = serviceSchema.safeParse(input); if (!p.success) return bad(p.error.issues[0]?.message);
  const { error } = await (await db()).from("services").update({ name: p.data.name, price_cents: p.data.price, duration_minutes: p.data.durationMinutes, duration_label: p.data.durationLabel || null, show_online: p.data.showOnline }).eq("id", p.data.id);
  if (error) return bad("Couldn't save.");
  revalidateTag("services"); revalidatePath("/admin/services");
  return { ok: true };
}

export async function createServiceAction(input: { name: string }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(input); if (!p.success) return bad("Enter a name.");
  const client = await db();
  const { data: s, error } = await client.from("services").insert({ shop_id: a.staff.profile.shop_id, name: p.data.name, duration_minutes: 20, show_online: false, sort_order: 99 }).select("id").single();
  if (error || !s) return bad("Couldn't add it.");
  const { data: barbers } = await client.from("barbers").select("id");
  if (barbers?.length) await client.from("barber_services").insert(barbers.map((b) => ({ barber_id: b.id, service_id: s.id })));
  revalidateTag("services"); revalidatePath("/admin/services");
  return { ok: true };
}

// ----------------------------------------------------------------- barbers
const barberSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(80), initials: z.string().trim().min(1).max(3), bio: z.string().trim().max(400), isPublished: z.boolean() });

export async function updateBarberAction(input: z.input<typeof barberSchema>): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = barberSchema.safeParse(input); if (!p.success) return bad(p.error.issues[0]?.message);
  const { error } = await (await db()).from("barbers").update({ name: p.data.name, initials: p.data.initials.toUpperCase(), bio: p.data.bio || null, is_published: p.data.isPublished }).eq("id", p.data.id);
  if (error) return bad("Couldn't save.");
  revalidateTag("barbers"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function createBarberAction(input: { name: string }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(input); if (!p.success) return bad("Enter a name.");
  const client = await db();
  const { data: b, error } = await client.from("barbers").insert({ shop_id: a.staff.profile.shop_id, name: p.data.name, initials: makeInitials(p.data.name), is_published: false, sort_order: 99 }).select("id").single();
  if (error || !b) return bad("Couldn't add them.");
  const { data: services } = await client.from("services").select("id");
  if (services?.length) await client.from("barber_services").insert(services.map((s) => ({ barber_id: b.id, service_id: s.id })));
  revalidateTag("barbers"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function setBarberServicesAction(input: { barberId: string; serviceIds: string[] }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ barberId: z.uuid(), serviceIds: z.array(z.uuid()).max(50) }).safeParse(input); if (!p.success) return bad();
  const client = await db();
  await client.from("barber_services").delete().eq("barber_id", p.data.barberId);
  if (p.data.serviceIds.length) {
    const { error } = await client.from("barber_services").insert(p.data.serviceIds.map((service_id) => ({ barber_id: p.data.barberId, service_id })));
    if (error) return bad("Couldn't save.");
  }
  revalidateTag("barbers");
  return { ok: true };
}

const hoursSchema = z.object({
  barberId: z.uuid(),
  days: z.array(z.object({ weekday: z.number().int().min(0).max(6), mode: z.enum(["shop", "custom", "off"]), opens: time, closes: time })).length(7),
});

export async function setBarberHoursAction(input: z.input<typeof hoursSchema>): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = hoursSchema.safeParse(input); if (!p.success) return bad();
  if (p.data.days.some((d) => d.mode === "custom" && d.closes <= d.opens)) return bad("Closing time must be after opening time.");
  const client = await db();
  await client.from("working_hours").delete().eq("barber_id", p.data.barberId);
  const rows = p.data.days.filter((d) => d.mode !== "shop").map((d) => ({ shop_id: a.staff.profile.shop_id, barber_id: p.data.barberId, weekday: d.weekday, opens: d.mode === "off" ? "09:00" : d.opens, closes: d.mode === "off" ? "10:00" : d.closes, is_off: d.mode === "off" }));
  if (rows.length) { const { error } = await client.from("working_hours").insert(rows); if (error) return bad("Couldn't save."); }
  revalidateTag("hours"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function addTimeOffAction(input: { barberId: string; startsOn: string; endsOn: string; reason: string }): Promise<ActionResult> {
  const a = await authorize(["owner", "barber"]); if (!a.ok) return a;
  const p = z.object({ barberId: z.uuid(), startsOn: z.string(), endsOn: z.string(), reason: z.string().trim().max(120) }).safeParse(input);
  if (!p.success || !isDay(p.data.startsOn) || !isDay(p.data.endsOn) || p.data.endsOn < p.data.startsOn) return bad("Pick a valid date range.");
  const shop = await getShop();
  const { error } = await (await db()).from("time_off").insert({ shop_id: a.staff.profile.shop_id, barber_id: p.data.barberId, starts_at: zoned(p.data.startsOn, 0, shop.timezone).toISOString(), ends_at: zoned(addDays(p.data.endsOn, 1), 0, shop.timezone).toISOString(), reason: p.data.reason || null });
  if (error) return bad("Couldn't save.");
  revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function removeTimeOffAction(id: string): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  if (!z.uuid().safeParse(id).success) return bad();
  const { error } = await (await db()).from("time_off").delete().eq("id", id);
  if (error) return bad("Couldn't remove it.");
  revalidatePath("/admin/barbers");
  return { ok: true };
}

// ---------------------------------------------------------------- messages
export async function setMessageSettingAction(input: { key: string; email: boolean; sms: boolean }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ key: z.enum(["confirmation", "reminder_24h", "reminder_2h", "walkin_next", "come_back"]), email: z.boolean(), sms: z.boolean() }).safeParse(input); if (!p.success) return bad();
  const { error } = await (await db()).from("message_settings").upsert({ shop_id: a.staff.profile.shop_id, template_key: p.data.key, email_enabled: p.data.email, sms_enabled: p.data.sms });
  if (error) return bad("Couldn't save.");
  revalidatePath("/admin/messages");
  return { ok: true };
}

// ---------------------------------------------------------------- settings
const settingsSchema = z.object({
  bookingWindowDays: z.coerce.number().int().min(1).max(365), minLeadMinutes: z.coerce.number().int().min(0).max(1440),
  slotStepMinutes: z.coerce.number().int().refine((n) => [10, 15, 20, 30, 60].includes(n)), avgWalkinMinutes: z.coerce.number().int().min(5).max(120),
  maxQueue: z.coerce.number().int().min(1).max(200), walkinRequiresOpen: z.boolean(),
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), closed: z.boolean(), opens: time, closes: time })).length(7),
});

export async function updateSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = settingsSchema.safeParse(input); if (!p.success) return bad("Please check the numbers.");
  if (p.data.hours.some((h) => !h.closed && h.closes <= h.opens)) return bad("Closing time must be after opening time.");
  const client = await db();
  const shopId = a.staff.profile.shop_id;
  const { error } = await client.from("shops").update({ booking_window_days: p.data.bookingWindowDays, min_lead_minutes: p.data.minLeadMinutes, slot_step_minutes: p.data.slotStepMinutes, avg_walkin_minutes: p.data.avgWalkinMinutes, max_queue: p.data.maxQueue, walkin_requires_open: p.data.walkinRequiresOpen }).eq("id", shopId);
  if (error) return bad("Couldn't save.");
  await client.from("working_hours").delete().eq("shop_id", shopId).is("barber_id", null);
  const rows = p.data.hours.filter((h) => !h.closed).map((h) => ({ shop_id: shopId, barber_id: null, weekday: h.weekday, opens: h.opens, closes: h.closes }));
  if (rows.length) { const r = await client.from("working_hours").insert(rows); if (r.error) return bad("Hours didn't save."); }
  revalidateTag("shop"); revalidateTag("hours"); revalidatePath("/");
  return { ok: true };
}
