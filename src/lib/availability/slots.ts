import { addDays, localDay, weekdayOf, zoned } from "./tz";

/**
 * Pure availability engine. Everything it needs is public-safe data (hours, barber on-duty flag,
 * busy blocks), so the same function can run on the server for the API and in tests.
 * The database still has the last word: `create_booking` re-validates and the exclusion constraint
 * rejects overlaps.
 */
export interface HoursRow { barberId: string | null; weekday: number; opens: string; closes: string; isOff: boolean }
export interface BusyBlock { barberId: string; start: number; end: number }
export interface BarberLite { id: string; onDuty: boolean }
export interface Slot { start: string; barberIds: string[] }

export interface SlotInput {
  now: Date;
  tz: string;
  day: string; // YYYY-MM-DD, shop-local
  slotStepMin: number;
  minLeadMin: number;
  windowDays: number;
  durationMin: number;
  barbers: BarberLite[]; // already filtered to those who do the service (and the chosen barber, if any)
  hours: HoursRow[];
  busy: BusyBlock[];
}

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export function effectiveHours(barberId: string, weekday: number, rows: HoursRow[]): { opens: number; closes: number } | null {
  const own = rows.find((r) => r.barberId === barberId && r.weekday === weekday);
  const row = own ?? rows.find((r) => r.barberId === null && r.weekday === weekday);
  if (!row || row.isOff) return null;
  return { opens: mins(row.opens), closes: mins(row.closes) };
}

export function computeSlots(input: SlotInput): Slot[] {
  const { now, tz, day, slotStepMin, minLeadMin, windowDays, durationMin, barbers, hours, busy } = input;
  const earliest = now.getTime() + minLeadMin * 60_000;
  const latest = now.getTime() + windowDays * 86_400_000;
  const isToday = localDay(now, tz) === day;
  const weekday = weekdayOf(day);
  const byStart = new Map<number, string[]>();

  for (const b of barbers) {
    if (isToday && !b.onDuty) continue;
    const h = effectiveHours(b.id, weekday, hours);
    if (!h) continue;
    const mine = busy.filter((x) => x.barberId === b.id);
    for (let m = h.opens; m + durationMin <= h.closes; m += slotStepMin) {
      const start = zoned(day, m, tz).getTime();
      const end = start + durationMin * 60_000;
      if (start < earliest || start > latest) continue;
      if (mine.some((x) => start < x.end && end > x.start)) continue;
      const list = byStart.get(start) ?? [];
      list.push(b.id);
      byStart.set(start, list);
    }
  }
  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([start, barberIds]) => ({ start: new Date(start).toISOString(), barberIds }));
}

/** Next open calendar days (shop-local), for the date picker. Skips closed weekdays. */
export function openDays(now: Date, tz: string, windowDays: number, shopHours: HoursRow[], max = 14): string[] {
  const out: string[] = [];
  const today = localDay(now, tz);
  for (let i = 0; i <= windowDays && out.length < max; i++) {
    const d = addDays(today, i);
    if (effectiveHours("", weekdayOf(d), shopHours)) out.push(d);
  }
  return out;
}

/** For "any barber": the free barber with the fewest busy minutes that day, so work spreads out. */
export function pickBarber(freeIds: string[], busy: BusyBlock[], day: string, tz: string): string | undefined {
  const from = zoned(day, 0, tz).getTime();
  const to = zoned(addDays(day, 1), 0, tz).getTime();
  const load = (id: string) => busy.filter((x) => x.barberId === id && x.start < to && x.end > from).reduce((a, x) => a + (x.end - x.start), 0);
  return [...freeIds].sort((a, b) => load(a) - load(b))[0];
}
