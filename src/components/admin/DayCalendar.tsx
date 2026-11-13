"use client";
import { useEffect, useState, useTransition } from "react";
import { sendReminderAction, setOnDutyAction, updateBookingStatusAction } from "@/app/admin/(app)/actions";
import { QueueList, type ChairOption, type QueueItem } from "./QueueList";

export interface CalBarber { id: string; name: string; onDuty: boolean }
export interface CalBooking { id: string; barberId: string; startMin: number; durMin: number; client: string; phone: string | null; service: string; status: string; source: string; price: string; note: string | null; timeLabel: string; barberName: string }

const HH = 72;
const STATUS: Record<string, string> = { booked: "Booked", in_chair: "In the chair", done: "Done", no_show: "No-show", cancelled: "Cancelled" };
const hourLabel = (h: number) => `${h % 12 || 12} ${h >= 12 ? "pm" : "am"}`;

export function DayCalendar({ barbers, bookings, queue, chairs, startHour, endHour, nowMin, tz }: {
  barbers: CalBarber[]; bookings: CalBooking[]; queue: QueueItem[]; chairs: ChairOption[]; startHour: number; endHour: number; nowMin: number | null; tz: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(nowMin);
  useEffect(() => {
    if (nowMin === null) return;
    const tick = () => { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); setNow(Number(p.find((x) => x.type === "hour")!.value) * 60 + Number(p.find((x) => x.type === "minute")!.value)); };
    tick(); const i = setInterval(tick, 30_000); return () => clearInterval(i);
  }, [nowMin, tz]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);

  const selected = bookings.find((b) => b.id === sel) ?? null;
  const height = (endHour - startHour) * HH;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; note?: string }>, ok: string) => start(async () => { const r = await fn(); setToast(r.ok ? (r.note ?? ok) : (r.error ?? "Failed")); });

  return (
    <div className="row">
      <div className="cal">
        <div className="calscroll">
          <div className="calin" style={{ ["--cols" as string]: barbers.length, ["--hh" as string]: `${HH}px` }}>
            <div className="calhead">
              <div />
              {barbers.map((b) => (
                <div key={b.id}>
                  <b>{b.name}</b>
                  <button className={b.onDuty ? "duty" : "duty off"} aria-pressed={b.onDuty} disabled={pending} onClick={() => run(() => setOnDutyAction(b.id, !b.onDuty), `${b.name} ${b.onDuty ? "marked off today" : "is working today"}`)}>
                    {b.onDuty ? "Working" : "Off today"}
                  </button>
                </div>
              ))}
            </div>
            <div className="calgrid" style={{ height }}>
              <div className="hours">{hours.map((h) => <span key={h} style={{ top: (h - startHour) * HH }}>{hourLabel(h)}</span>)}</div>
              {barbers.map((b) => (
                <div key={b.id} className={b.onDuty ? "colm" : "colm off"}>
                  {bookings.filter((x) => x.barberId === b.id).map((x) => (
                    <button key={x.id} className={`bkc ${x.status === "booked" ? "" : x.source === "walk_in" && x.status === "in_chair" ? "in_chair walk" : x.status} ${sel === x.id ? "sel" : ""}`}
                      style={{ top: ((x.startMin - startHour * 60) / 60) * HH + 2, height: Math.max(x.durMin, 30) / 60 * HH - 4 }} onClick={() => setSel(x.id)}>
                      <b>{x.client}</b><small>{x.timeLabel} · {x.service}</small>
                    </button>
                  ))}
                </div>
              ))}
              {now !== null && now >= startHour * 60 && now <= endHour * 60 && <div className="nowline" style={{ top: ((now - startHour * 60) / 60) * HH }} aria-hidden="true" />}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        {selected ? (
          <>
            <div className="ph"><b>Booking</b><button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Close</button></div>
            <div className="pb">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="av" style={{ width: 46, height: 46, fontSize: 16, margin: 0 }}>{selected.client.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span><b style={{ fontSize: 17 }}>{selected.client}</b></div>
              <div className="dl"><span>Service</span><b>{selected.service}</b></div>
              <div className="dl"><span>Barber</span><b>{selected.barberName}</b></div>
              <div className="dl"><span>Time</span><b>{selected.timeLabel}</b></div>
              <div className="dl"><span>Price</span><b>{selected.price}</b></div>
              <div className="dl"><span>Phone</span><b>{selected.phone ?? "—"}</b></div>
              <div className="dl"><span>Status</span><span className="pill">{STATUS[selected.status] ?? selected.status}</span></div>
              {selected.note && <p style={{ margin: "6px 0 0", color: "var(--a-mute)", fontSize: 13 }}>Note: {selected.note}</p>}
              <div className="acts">
                <button className="btn btn-ink btn-sm" disabled={pending} onClick={() => run(() => updateBookingStatusAction({ bookingId: selected.id, status: "in_chair" }), "Marked in the chair")}>In the chair</button>
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => updateBookingStatusAction({ bookingId: selected.id, status: "done" }), "Marked done")}>Done</button>
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => updateBookingStatusAction({ bookingId: selected.id, status: "no_show" }), "Marked no-show")}>No-show</button>
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => sendReminderAction(selected.id), "Reminder sent")}>Send reminder</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="ph"><b>Walk-in line</b><span className="live-tag"><span className="dot" style={{ width: 8, height: 8 }} aria-hidden="true" />Live</span></div>
            <QueueList items={queue} chairs={chairs} compact />
          </>
        )}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
