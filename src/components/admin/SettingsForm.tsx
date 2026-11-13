"use client";
import * as Switch from "@radix-ui/react-switch";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/admin/(app)/manage/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export interface SettingsData {
  bookingWindowDays: number; minLeadMinutes: number; slotStepMinutes: number; avgWalkinMinutes: number; maxQueue: number; walkinRequiresOpen: boolean;
  hours: Array<{ weekday: number; closed: boolean; opens: string; closes: string }>;
}

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const num = (k: "bookingWindowDays" | "minLeadMinutes" | "avgWalkinMinutes" | "maxQueue") => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateSettingsAction(v); setMsg(r.ok ? { ok: true, text: "Saved. The website now shows the new hours." } : { ok: false, text: r.error }); }); }}>
      <section className="card-a">
        <b>Shop hours</b>
        <p style={{ margin: "2px 0 10px", color: "var(--a-mute)" }}>These are the hours shown on the website and the limits for online booking.</p>
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
          const h = v.hours.find((x) => x.weekday === wd)!;
          const set = (patch: Partial<typeof h>) => setV({ ...v, hours: v.hours.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)) });
          return (
            <div key={wd} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
              <span style={{ width: 96 }}>{DAYS[wd]}</span>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><Switch.Root className="sw" checked={!h.closed} onCheckedChange={(c) => set({ closed: !c })} aria-label={`${DAYS[wd]} open`} />{h.closed ? "Closed" : "Open"}</label>
              {!h.closed && <><input className="inp" type="time" value={h.opens.slice(0, 5)} onChange={(e) => set({ opens: e.target.value })} aria-label={`${DAYS[wd]} opens`} /> to <input className="inp" type="time" value={h.closes.slice(0, 5)} onChange={(e) => set({ closes: e.target.value })} aria-label={`${DAYS[wd]} closes`} /></>}
            </div>
          );
        })}
      </section>
      <section className="card-a grid-a">
        <label className="fld">How far ahead can people book? (days)<input className="inp" type="number" min={1} max={365} value={v.bookingWindowDays} onChange={num("bookingWindowDays")} /></label>
        <label className="fld">Shortest notice for online booking (minutes)<input className="inp" type="number" min={0} max={1440} value={v.minLeadMinutes} onChange={num("minLeadMinutes")} /></label>
        <label className="fld">Booking time slots every<select value={v.slotStepMinutes} onChange={(e) => setV({ ...v, slotStepMinutes: Number(e.target.value) })}>{[10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        <label className="fld">Average walk-in cut (minutes, for wait estimates)<input className="inp" type="number" min={5} max={120} value={v.avgWalkinMinutes} onChange={num("avgWalkinMinutes")} /></label>
        <label className="fld">Most people allowed in the line<input className="inp" type="number" min={1} max={200} value={v.maxQueue} onChange={num("maxQueue")} /></label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}><Switch.Root className="sw" checked={v.walkinRequiresOpen} onCheckedChange={(c) => setV({ ...v, walkinRequiresOpen: c })} aria-label="Only allow joining the line while open" />Only allow joining the line while the shop is open</label>
      </section>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn btn-red" type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
        {msg && <span role="status" className={msg.ok ? "ok-msg" : "form-error"}>{msg.text}</span>}
      </div>
    </form>
  );
}
