import { TZDate } from "@date-fns/tz";

/** 'YYYY-MM-DD' of an instant, as seen on the wall clock in `tz`. */
export function localDay(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The instant at `minutes` after local midnight on `day` in `tz` (DST-safe via TZDate). */
export function zoned(day: string, minutes: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0, tz);
  return new Date(t.getTime());
}

export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
