import { describe, expect, it } from "vitest";
import { computeSlots, openDays, pickBarber, type HoursRow } from "./slots";
import { localDay, zoned } from "./tz";

const TZ = "America/Toronto";
const shop: HoursRow[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ barberId: null, weekday: d, opens: "09:00:00", closes: "17:45:00", isOff: false })),
  { barberId: null, weekday: 6, opens: "09:00:00", closes: "16:00:00", isOff: false },
];
// Wed 2026-11-18 10:00 Toronto as "now" -> plenty of tomorrow/next week to test
const now = zoned("2026-11-18", 10 * 60, TZ);
const base = { now, tz: TZ, slotStepMin: 30, minLeadMin: 30, windowDays: 30, durationMin: 20, hours: shop, busy: [] };
const A = { id: "A", onDuty: true };
const B = { id: "B", onDuty: true };
const hhmm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

describe("computeSlots", () => {
  it("lists 30-minute starts across the shop day and respects closing time", () => {
    const s = computeSlots({ ...base, day: "2026-11-19", barbers: [A] });
    expect(hhmm(s[0]!.start)).toBe("09:00");
    expect(hhmm(s.at(-1)!.start)).toBe("17:00"); // a 17:30 start would end 17:50, after the 17:45 close
  });

  it("returns nothing on a closed day (Sunday)", () => {
    expect(computeSlots({ ...base, day: "2026-11-22", barbers: [A] })).toEqual([]);
  });

  it("enforces the minimum lead time today", () => {
    const s = computeSlots({ ...base, day: "2026-11-18", barbers: [A] });
    expect(hhmm(s[0]!.start)).toBe("10:30"); // now 10:00 + 30 min lead
  });

  it("skips slots overlapping a busy block, including partial overlap", () => {
    const busyStart = zoned("2026-11-19", 10 * 60, TZ).getTime();
    const s = computeSlots({ ...base, day: "2026-11-19", barbers: [A], busy: [{ barberId: "A", start: busyStart, end: busyStart + 25 * 60_000 }] });
    const times = s.map((x) => hhmm(x.start));
    expect(times).toContain("09:30"); // 09:30-09:50 free
    expect(times).not.toContain("10:00");
    expect(times).toContain("10:30");
  });

  it("another barber's busy block does not block this barber", () => {
    const t = zoned("2026-11-19", 10 * 60, TZ).getTime();
    const s = computeSlots({ ...base, day: "2026-11-19", barbers: [A, B], busy: [{ barberId: "A", start: t, end: t + 20 * 60_000 }] });
    const ten = s.find((x) => hhmm(x.start) === "10:00")!;
    expect(ten.barberIds).toEqual(["B"]);
  });

  it("off-duty barbers vanish for today only", () => {
    const off = { id: "A", onDuty: false };
    expect(computeSlots({ ...base, day: "2026-11-18", barbers: [off] })).toEqual([]);
    expect(computeSlots({ ...base, day: "2026-11-19", barbers: [off] }).length).toBeGreaterThan(0);
  });

  it("a barber override replaces shop hours; is_off removes the day", () => {
    const hours: HoursRow[] = [...shop, { barberId: "A", weekday: 4, opens: "12:00:00", closes: "14:00:00", isOff: false }, { barberId: "B", weekday: 4, opens: "09:00:00", closes: "17:00:00", isOff: true }];
    const s = computeSlots({ ...base, hours, day: "2026-11-19", barbers: [A, B] });
    expect(hhmm(s[0]!.start)).toBe("12:00");
    expect(s.every((x) => !x.barberIds.includes("B"))).toBe(true);
  });

  it("respects the booking window", () => {
    expect(computeSlots({ ...base, windowDays: 3, day: "2026-12-30", barbers: [A] })).toEqual([]);
  });

  it("is DST-safe: the Sunday clocks go back (2026-11-01) is closed, Monday 9:00 is 9:00 local", () => {
    const n = zoned("2026-10-30", 9 * 60, TZ);
    const s = computeSlots({ ...base, now: n, day: "2026-11-02", barbers: [A] });
    expect(hhmm(s[0]!.start)).toBe("09:00");
  });
});

describe("helpers", () => {
  it("openDays skips Sundays", () => {
    const days = openDays(now, TZ, 30, shop, 8);
    expect(days[0]).toBe("2026-11-18");
    expect(days).not.toContain("2026-11-22");
    expect(days).toHaveLength(8);
  });

  it("pickBarber prefers the less busy barber", () => {
    const t = zoned("2026-11-19", 9 * 60, TZ).getTime();
    const busy = [{ barberId: "A", start: t, end: t + 3_600_000 }];
    expect(pickBarber(["A", "B"], busy, "2026-11-19", TZ)).toBe("B");
  });

  it("localDay uses the shop timezone, not UTC", () => {
    expect(localDay(new Date("2026-11-19T03:30:00Z"), TZ)).toBe("2026-11-18");
  });
});
