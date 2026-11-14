"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { addDays, isDay, zoned } from "@/lib/availability/tz";
import { authorize } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import { initials as makeInitials } from "@/lib/format";
import type { ActionResult } from "@/lib/schemas/common";

/** Owner-only configuration. authorize(["owner"]) first, then Zod, then parameterised SQL scoped to the owner's shop. */
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
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
  try {
    await q("update services set name = $2, price_cents = $3, duration_minutes = $4, duration_label = $5, show_online = $6 where id = $1 and shop_id = $7", [p.data.id, p.data.name, p.data.price, p.data.durationMinutes, p.data.durationLabel || null, p.data.showOnline, a.staff.profile.shop_id]);
  } catch { return bad("Couldn't save."); }
  revalidateTag("services"); revalidatePath("/admin/services");
  return { ok: true };
}

export async function createServiceAction(input: { name: string }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(input); if (!p.success) return bad("Enter a name.");
  try {
    await q("with s as (insert into services (shop_id, name, duration_minutes, show_online, sort_order) values ($1, $2, 20, false, 99) returning id) insert into barber_services (barber_id, service_id) select b.id, s.id from barbers b, s where b.shop_id = $1", [a.staff.profile.shop_id, p.data.name]);
  } catch { return bad("Couldn't add it."); }
  revalidateTag("services"); revalidatePath("/admin/services");
  return { ok: true };
}

// ----------------------------------------------------------------- barbers
const barberSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(80), initials: z.string().trim().min(1).max(3), bio: z.string().trim().max(400), isPublished: z.boolean() });

export async function updateBarberAction(input: z.input<typeof barberSchema>): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = barberSchema.safeParse(input); if (!p.success) return bad(p.error.issues[0]?.message);
  try {
    await q("update barbers set name = $2, initials = $3, bio = $4, is_published = $5 where id = $1 and shop_id = $6", [p.data.id, p.data.name, p.data.initials.toUpperCase(), p.data.bio || null, p.data.isPublished, a.staff.profile.shop_id]);
  } catch { return bad("Couldn't save."); }
  revalidateTag("barbers"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function createBarberAction(input: { name: string }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(input); if (!p.success) return bad("Enter a name.");
  try {
    await q("with b as (insert into barbers (shop_id, name, initials, is_published, sort_order) values ($1, $2, $3, false, 99) returning id) insert into barber_services (barber_id, service_id) select b.id, s.id from services s, b where s.shop_id = $1", [a.staff.profile.shop_id, p.data.name, makeInitials(p.data.name)]);
  } catch { return bad("Couldn't add them."); }
  revalidateTag("barbers"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function setBarberServicesAction(input: { barberId: string; serviceIds: string[] }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ barberId: z.uuid(), serviceIds: z.array(z.uuid()).max(50) }).safeParse(input); if (!p.success) return bad();
  try {
    await q("delete from barber_services where barber_id = $1 and barber_id in (select id from barbers where shop_id = $2)", [p.data.barberId, a.staff.profile.shop_id]);
    if (p.data.serviceIds.length) await q("insert into barber_services (barber_id, service_id) select $1::uuid, id from services where id = any($2::uuid[]) and shop_id = $3", [p.data.barberId, p.data.serviceIds, a.staff.profile.shop_id]);
  } catch { return bad("Couldn't save."); }
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
  const shopId = a.staff.profile.shop_id;
  try {
    await q("delete from working_hours where barber_id = $1 and shop_id = $2", [p.data.barberId, shopId]);
    for (const d of p.data.days.filter((x) => x.mode !== "shop")) {
      await q("insert into working_hours (shop_id, barber_id, weekday, opens, closes, is_off) values ($1, $2, $3, $4, $5, $6)", [shopId, p.data.barberId, d.weekday, d.mode === "off" ? "09:00" : d.opens, d.mode === "off" ? "10:00" : d.closes, d.mode === "off"]);
    }
  } catch { return bad("Couldn't save."); }
  revalidateTag("hours"); revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function addTimeOffAction(input: { barberId: string; startsOn: string; endsOn: string; reason: string }): Promise<ActionResult> {
  const a = await authorize(["owner", "barber"]); if (!a.ok) return a;
  const p = z.object({ barberId: z.uuid(), startsOn: z.string(), endsOn: z.string(), reason: z.string().trim().max(120) }).safeParse(input);
  if (!p.success || !isDay(p.data.startsOn) || !isDay(p.data.endsOn) || p.data.endsOn < p.data.startsOn) return bad("Pick a valid date range.");
  const shop = await getShop();
  try {
    await q("insert into time_off (shop_id, barber_id, starts_at, ends_at, reason) select $1, id, $3::timestamptz, $4::timestamptz, $5 from barbers where id = $2 and shop_id = $1",
      [a.staff.profile.shop_id, p.data.barberId, zoned(p.data.startsOn, 0, shop.timezone).toISOString(), zoned(addDays(p.data.endsOn, 1), 0, shop.timezone).toISOString(), p.data.reason || null]);
  } catch { return bad("Couldn't save."); }
  revalidatePath("/admin/barbers");
  return { ok: true };
}

export async function removeTimeOffAction(id: string): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  if (!z.uuid().safeParse(id).success) return bad();
  try { await q("delete from time_off where id = $1 and shop_id = $2", [id, a.staff.profile.shop_id]); } catch { return bad("Couldn't remove it."); }
  revalidatePath("/admin/barbers");
  return { ok: true };
}

// ---------------------------------------------------------------- messages
export async function setMessageSettingAction(input: { key: string; email: boolean; sms: boolean }): Promise<ActionResult> {
  const a = await authorize(["owner"]); if (!a.ok) return a;
  const p = z.object({ key: z.enum(["confirmation", "reminder_24h", "reminder_2h", "walkin_next", "come_back"]), email: z.boolean(), sms: z.boolean() }).safeParse(input); if (!p.success) return bad();
  try {
    await q("insert into message_settings (shop_id, template_key, email_enabled, sms_enabled) values ($1, $2, $3, $4) on conflict (shop_id, template_key) do update set email_enabled = excluded.email_enabled, sms_enabled = excluded.sms_enabled", [a.staff.profile.shop_id, p.data.key, p.data.email, p.data.sms]);
  } catch { return bad("Couldn't save."); }
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
  const shopId = a.staff.profile.shop_id;
  try {
    await q("update shops set booking_window_days = $2, min_lead_minutes = $3, slot_step_minutes = $4, avg_walkin_minutes = $5, max_queue = $6, walkin_requires_open = $7 where id = $1", [shopId, p.data.bookingWindowDays, p.data.minLeadMinutes, p.data.slotStepMinutes, p.data.avgWalkinMinutes, p.data.maxQueue, p.data.walkinRequiresOpen]);
    await q("delete from working_hours where shop_id = $1 and barber_id is null", [shopId]);
    for (const h of p.data.hours.filter((x) => !x.closed)) await q("insert into working_hours (shop_id, barber_id, weekday, opens, closes) values ($1, null, $2, $3, $4)", [shopId, h.weekday, h.opens, h.closes]);
  } catch { return bad("Couldn't save."); }
  revalidateTag("shop"); revalidateTag("hours"); revalidatePath("/");
  return { ok: true };
}
