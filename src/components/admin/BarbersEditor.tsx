"use client";
import * as Switch from "@radix-ui/react-switch";
import { useState, useTransition } from "react";
import { addTimeOffAction, createBarberAction, removeTimeOffAction, setBarberHoursAction, setBarberServicesAction, updateBarberAction } from "@/app/admin/(app)/manage/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Mode = "shop" | "custom" | "off";
export interface BarberData {
  id: string; name: string; initials: string; bio: string; isPublished: boolean; serviceIds: string[];
  days: Array<{ weekday: number; mode: Mode; opens: string; closes: string }>;
  timeOff: Array<{ id: string; label: string; reason: string | null }>;
}
export interface ServiceOpt { id: string; name: string }

function BarberCard({ b, services, today }: { b: BarberData; services: ServiceOpt[]; today: string }) {
  const [v, setV] = useState({ name: b.name, initials: b.initials, bio: b.bio, isPublished: b.isPublished });
  const [svc, setSvc] = useState(new Set(b.serviceIds));
  const [days, setDays] = useState(b.days);
  const [off, setOff] = useState({ startsOn: today, endsOn: today, reason: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const note = (r: { ok: boolean; error?: string }, ok = "Saved") => setMsg(r.ok ? ok : (r.error ?? "Failed"));

  return (
    <details className="card-a" open={b.name === "" ? true : undefined}>
      <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center", minHeight: 44 }}>
        <span className="av" style={{ width: 38, height: 38, margin: 0 }}>{b.initials}</span><b>{b.name}</b>
        {!b.isPublished && <span className="pill">Hidden from website</span>}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 14 }}>
        <section className="grid-a">
          <label className="fld">Name<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="fld">Initials (shown until there&apos;s a photo)<input value={v.initials} maxLength={3} onChange={(e) => setV({ ...v, initials: e.target.value })} /></label>
          <label className="fld" style={{ gridColumn: "1 / -1" }}>A line about them (optional)<textarea value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} /></label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}><Switch.Root className="sw" checked={v.isPublished} onCheckedChange={(c) => setV({ ...v, isPublished: c })} aria-label="Show on website" />Show on website and booking</label>
          <div><button className="btn btn-red btn-sm" disabled={pending} onClick={() => start(async () => note(await updateBarberAction({ id: b.id, ...v })))}>Save details</button></div>
        </section>

        <section>
          <b>Services they do</b>
          <div className="chips" style={{ marginTop: 8 }}>
            {services.map((s) => (
              <label key={s.id} className="pill" style={{ gap: 6, minHeight: 32, cursor: "pointer", background: svc.has(s.id) ? "#eaf5ed" : undefined }}>
                <input type="checkbox" checked={svc.has(s.id)} onChange={(e) => { const n = new Set(svc); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSvc(n); }} />{s.name}
              </label>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={pending} onClick={() => start(async () => note(await setBarberServicesAction({ barberId: b.id, serviceIds: [...svc] })))}>Save services</button>
        </section>

        <section>
          <b>Working hours</b>
          <p style={{ margin: "2px 0 8px", color: "var(--a-mute)" }}>“Shop hours” follows the shop. Pick Custom or Off for a different weekly pattern.</p>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const d = days.find((x) => x.weekday === wd)!;
            const set = (patch: Partial<typeof d>) => setDays(days.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)));
            return (
              <div key={wd} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
                <span style={{ width: 96 }}>{DAYS[wd]}</span>
                <select className="inp" value={d.mode} onChange={(e) => set({ mode: e.target.value as Mode })} aria-label={`${DAYS[wd]} hours mode`}><option value="shop">Shop hours</option><option value="custom">Custom</option><option value="off">Off</option></select>
                {d.mode === "custom" && <><input className="inp" type="time" value={d.opens.slice(0, 5)} onChange={(e) => set({ opens: e.target.value })} aria-label="Opens" /> to <input className="inp" type="time" value={d.closes.slice(0, 5)} onChange={(e) => set({ closes: e.target.value })} aria-label="Closes" /></>}
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={pending} onClick={() => start(async () => note(await setBarberHoursAction({ barberId: b.id, days })))}>Save hours</button>
        </section>

        <section>
          <b>Days off</b>
          <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
            {b.timeOff.length === 0 && <li style={{ color: "var(--a-mute)", listStyle: "none", marginLeft: -18 }}>None booked.</li>}
            {b.timeOff.map((t) => <li key={t.id}>{t.label}{t.reason ? ` · ${t.reason}` : ""} <button className="link-btn" style={{ color: "#8e1b22" }} onClick={() => start(async () => note(await removeTimeOffAction(t.id), "Removed"))}>Remove</button></li>)}
          </ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input className="inp" type="date" value={off.startsOn} onChange={(e) => setOff({ ...off, startsOn: e.target.value, endsOn: off.endsOn < e.target.value ? e.target.value : off.endsOn })} aria-label="First day off" />
            to <input className="inp" type="date" value={off.endsOn} min={off.startsOn} onChange={(e) => setOff({ ...off, endsOn: e.target.value })} aria-label="Last day off" />
            <input className="inp" placeholder="Reason (private)" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} aria-label="Reason" />
            <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => note(await addTimeOffAction({ barberId: b.id, ...off }), "Day off added. Clients can no longer book those days."))}>Add days off</button>
          </div>
        </section>
        {msg && <p role="status" className={msg === "Saved" || !/fail|couldn|pick|check/i.test(msg) ? "ok-msg" : "form-error"}>{msg}</p>}
      </div>
    </details>
  );
}

export function BarbersEditor({ barbers, services, today }: { barbers: BarberData[]; services: ServiceOpt[]; today: string }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {barbers.map((b) => <BarberCard key={b.id + JSON.stringify(b)} b={b} services={services} today={today} />)}
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const n = name; setName(""); start(async () => { await createBarberAction({ name: n }); }); }}>
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="New barber's name" aria-label="New barber name" style={{ width: 260 }} />
        <button className="btn btn-ink btn-sm" type="submit" disabled={!name.trim() || pending}>Add barber</button>
      </form>
    </div>
  );
}
