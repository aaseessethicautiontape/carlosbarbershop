import { formatHourMinute, WEEKDAYS } from "@/lib/format";

export interface ShopHour { weekday: number; opens: string; closes: string; is_off: boolean }

/** Wall-clock weekday + minutes-since-midnight in the shop's timezone. */
export function localParts(now: Date, tz: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const mins = (t: string) => { const [h, m] = t.split(":").map(Number) as [number, number]; return h * 60 + m; };

export function openStatus(now: Date, tz: string, hours: ShopHour[]): { open: boolean; closesAt?: string; nextOpen?: string } {
  const { weekday, minutes } = localParts(now, tz);
  const today = hours.find((h) => h.weekday === weekday && !h.is_off);
  if (today && minutes >= mins(today.opens) && minutes < mins(today.closes)) return { open: true, closesAt: formatHourMinute(today.closes) };
  for (let i = 0; i < 8; i++) {
    const wd = (weekday + i) % 7;
    const h = hours.find((x) => x.weekday === wd && !x.is_off);
    if (h && (i > 0 || minutes < mins(h.opens))) {
      return { open: false, nextOpen: `${i === 0 ? "today" : i === 1 ? "tomorrow" : WEEKDAYS[wd]} at ${formatHourMinute(h.opens)}` };
    }
  }
  return { open: false };
}

/** Group Mon..Sun rows for display, e.g. [{day:'Monday', time:'9 am to 5:45 pm'}, ...] */
export function hoursRows(hours: ShopHour[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const h = hours.find((x) => x.weekday === wd && !x.is_off);
    return { weekday: wd, day: WEEKDAYS[wd]!, time: h ? `${formatHourMinute(h.opens)} to ${formatHourMinute(h.closes)}` : "Closed" };
  });
}
