/** Money, phones and dates. Prices with no value yet render as [PRICE] (see PLAN.md decision 3). */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "[PRICE]";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** Canadian-friendly E.164 normaliser. Returns null when it can't be a real number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : e164;
}

const f = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...o });

export const formatClock = (d: Date | string, tz: string) => f(tz, { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d)).replace(/\s?([ap])\.?m\.?/i, " $1m");
export const formatDayLong = (d: Date | string, tz: string) => f(tz, { weekday: "long", month: "short", day: "numeric" }).format(new Date(d));
export const formatWhen = (d: Date | string, tz: string) => `${formatDayLong(d, tz)} at ${formatClock(d, tz)}`;

/** '09:00:00' -> '9 am', '17:45:00' -> '5:45 pm' */
export function formatHourMinute(t: string): string {
  const [h, m] = t.split(":").map(Number) as [number, number];
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""} ${h >= 12 ? "pm" : "am"}`;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
