import "server-only";
import { q } from "@/lib/db";
import { getBarberServices, getBarbers, getHours, getServices, getShop } from "@/lib/data/public";
import { computeSlots, type BusyBlock, type HoursRow, type Slot } from "./slots";
import { addDays, zoned } from "./tz";

/** Postgres tstzrange text, e.g. ["2026-11-19 15:00:00+00","2026-11-19 15:20:00+00"), -> [startMs, endMs] */
export function parseRange(text: string): [number, number] {
  const m = /^[\[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(text);
  const ts = (v?: string) => Date.parse((v ?? "").replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return [ts(m?.[1]), ts(m?.[2])];
}

export const toHoursRows = (rows: Awaited<ReturnType<typeof getHours>>): HoursRow[] =>
  rows.map((r) => ({ barberId: r.barber_id, weekday: r.weekday, opens: r.opens, closes: r.closes, isOff: r.is_off }));

/** Free slots for one local day, from public-safe data only (hours, on-duty flags, busy_blocks). */
export async function loadSlots(opts: { serviceId: string; barberId: string | "any"; day: string; now?: Date }): Promise<{ slots: Slot[]; busy: BusyBlock[]; error?: string }> {
  const now = opts.now ?? new Date();
  const [shop, services, barbers, links, hours] = await Promise.all([getShop(), getServices(), getBarbers(), getBarberServices(), getHours()]);
  const service = services.find((s) => s.id === opts.serviceId);
  if (!service) return { slots: [], busy: [], error: "service_unavailable" };

  const doing = new Set(links.filter((l) => l.service_id === service.id).map((l) => l.barber_id));
  const candidates = barbers.filter((b) => doing.has(b.id) && (opts.barberId === "any" || b.id === opts.barberId));

  const from = zoned(opts.day, 0, shop.timezone);
  const to = zoned(addDays(opts.day, 1), 0, shop.timezone);
  // Live read of the public mirror table (no personal data), never cached. on_duty is read live as well.
  const [rows, duty] = await Promise.all([
    q<{ barber_id: string; during: string }>("select barber_id, during::text as during from busy_blocks where barber_id = any($1::uuid[]) and during && tstzrange($2::timestamptz, $3::timestamptz)", [candidates.map((b) => b.id), from.toISOString(), to.toISOString()]),
    q<{ id: string; on_duty: boolean }>("select id, on_duty from barbers where id = any($1::uuid[])", [candidates.map((b) => b.id)]),
  ]);
  const onDuty = new Map(duty.map((d) => [d.id, d.on_duty]));
  const busy: BusyBlock[] = rows
    .map((r) => {
      const [start, end] = parseRange(String(r.during));
      return { barberId: r.barber_id, start, end };
    })
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));

  const slots = computeSlots({
    now, tz: shop.timezone, day: opts.day, slotStepMin: shop.slot_step_minutes, minLeadMin: shop.min_lead_minutes,
    windowDays: shop.booking_window_days, durationMin: service.duration_minutes,
    barbers: candidates.map((b) => ({ id: b.id, onDuty: onDuty.get(b.id) ?? b.on_duty })), hours: toHoursRows(hours), busy,
  });
  return { slots, busy };
}
