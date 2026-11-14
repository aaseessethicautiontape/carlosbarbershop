"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLive } from "@/components/useLive";

interface Props {
  serviceId: string;
  barberId: string; // uuid | "any"
  days: string[]; // YYYY-MM-DD in shop time
  tz: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  onGone?: () => void;
}

const dayParts = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...o }).format(d);
  return { wd: f({ weekday: "short" }), n: f({ day: "numeric" }) };
};

/**
 * Date + time chooser. Times come from /api/availability (public-safe data) and refresh LIVE when
 * anyone books, cancels, or a barber goes on/off duty (Realtime on busy_blocks + barbers).
 */
export function SlotPicker({ serviceId, barberId, days, tz, value, onChange, onGone }: Props) {
  const [day, setDay] = useState(days[0] ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const load = useCallback(async () => {
    if (!day) return;
    try {
      const res = await fetch(`/api/availability?service=${serviceId}&barber=${barberId}&day=${day}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 429 ? "Too many requests, one moment…" : "Couldn't load times.");
      const json = (await res.json()) as { slots: string[] };
      setSlots(json.slots);
      setError(null);
      if (valueRef.current && !json.slots.includes(valueRef.current)) {
        onGone?.(); // the time they picked was just taken (or a barber went off duty)
        onChange(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load times.");
    }
  }, [day, serviceId, barberId, onChange, onGone]);

  useEffect(() => { setSlots(null); void load(); }, [load]);

  // Re-check availability whenever anyone books, cancels, or a barber goes on/off duty (sealed "public" ticker).
  const lastTick = useRef<string | null>(null);
  useLive<{ n: string }>("public", (rows) => {
    const n = rows[0]?.n;
    if (n === undefined) return;
    if (lastTick.current !== null && lastTick.current !== n) void load();
    lastTick.current = n;
  });

  const clock = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(/\s?([ap])\.?m\.?/i, "");

  return (
    <div>
      <div className="days" role="group" aria-label="Day">
        {days.map((d, i) => {
          const p = dayParts(d);
          return (
            <button type="button" key={d} className={d === day ? "day on" : "day"} aria-pressed={d === day} onClick={() => { setDay(d); onChange(null); }}>
              <span>{i === 0 ? "Soon" : p.wd}</span><b>{p.n}</b>
            </button>
          );
        })}
      </div>
      <div aria-live="polite" style={{ minHeight: 56 }}>
        {error ? <p className="form-error">{error}</p> : null}
        {slots && slots.length === 0 ? <p className="lede">Nothing open that day. Try another day, or join the walk-in line.</p> : null}
        {slots === null && !error ? <p className="lede">Loading times…</p> : null}
        <div className="grid4">
          {slots?.map((s) => (
            <button type="button" key={s} className={s === value ? "slot on" : "slot"} aria-pressed={s === value} onClick={() => onChange(s)}>{clock(s)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
