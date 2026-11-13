"use client";
import { useState, useTransition } from "react";
import { addWalkinAction, removeWalkinAction, seatWalkinAction } from "@/app/admin/(app)/actions";

export interface QueueItem { id: string; position: number; name: string; service: string; waitingMin: number; hasPhone: boolean }
export interface ChairOption { id: string; name: string; free: boolean }

/** Live walk-in line for staff. "Seat with [barber]" creates an in-chair booking and removes it from every screen. */
export function QueueList({ items, chairs, compact = false }: { items: QueueItem[]; chairs: ChairOption[]; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const firstFree = chairs.find((c) => c.free)?.id ?? chairs[0]?.id ?? "";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed" }); });

  return (
    <div>
      <div className="pb" style={compact ? undefined : { padding: 0 }}>
        {items.length === 0 && <p style={{ color: "var(--a-mute)", textAlign: "center", margin: "30px 0" }}>No one waiting. Nice.</p>}
        {items.map((w) => {
          const chair = pick[w.id] ?? firstFree;
          return (
            <div className="qi" key={w.id}>
              <span className="n">{w.position}</span>
              <div className="meta"><b>{w.name}</b><br /><small>{w.service} · waiting {w.waitingMin} min{w.hasPhone ? " · will be texted" : ""}</small></div>
              <div className="ctl">
                <select aria-label={`Chair for ${w.name}`} value={chair} onChange={(e) => setPick({ ...pick, [w.id]: e.target.value })}>
                  {chairs.map((c) => <option key={c.id} value={c.id}>{c.name}{c.free ? "" : " (busy)"}</option>)}
                </select>
                <button className="btn btn-red btn-sm" disabled={pending || !chair} onClick={() => run(() => seatWalkinAction(w.id, chair), `${w.name} seated`)}>Seat</button>
                <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => removeWalkinAction(w.id), `${w.name} removed`)} aria-label={`Remove ${w.name}`}>Remove</button>
              </div>
            </div>
          );
        })}
        {msg && <p role="status" className={msg.ok ? "ok-msg" : "form-error"}>{msg.text}</p>}
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--a-mute)" }}>Customers who join from the website show up here instantly. Seating puts them on the chair and on the calendar.</p>
      </div>
      <form className="addw" onSubmit={(e) => { e.preventDefault(); const n = name; run(() => addWalkinAction({ name: n }), `${n} added`); setName(""); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a walk-in by name" aria-label="Walk-in name" />
        <button className="btn btn-ink btn-sm" type="submit" disabled={!name.trim() || pending}>Add</button>
      </form>
    </div>
  );
}
