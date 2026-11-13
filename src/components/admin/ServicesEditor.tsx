"use client";
import * as Switch from "@radix-ui/react-switch";
import { useState, useTransition } from "react";
import { createServiceAction, updateServiceAction } from "@/app/admin/(app)/manage/actions";

export interface ServiceRowData { id: string; name: string; price: string; durationMinutes: number; durationLabel: string; showOnline: boolean }
const cols = { ["--tcols" as string]: "1.6fr 0.9fr 0.8fr 1fr 0.8fr 0.7fr" };

function Row({ s }: { s: ServiceRowData }) {
  const [v, setV] = useState(s);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(s) && !msg?.startsWith("Saved");
  const save = (next = v) => start(async () => { const r = await updateServiceAction(next); setMsg(r.ok ? "Saved" : r.error); });
  return (
    <div className="tr" style={cols}>
      <input className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label={`Name of ${s.name}`} />
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>$<input className="inp" style={{ width: 90 }} inputMode="decimal" placeholder="[PRICE]" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} aria-label={`Price of ${s.name}`} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}><input className="inp" style={{ width: 70 }} type="number" min={5} max={240} value={v.durationMinutes} onChange={(e) => setV({ ...v, durationMinutes: Number(e.target.value) })} aria-label={`Minutes for ${s.name}`} />min</label>
      <input className="inp" value={v.durationLabel} onChange={(e) => setV({ ...v, durationLabel: e.target.value })} placeholder="e.g. 15 to 20 min" aria-label={`Time label for ${s.name}`} />
      <Switch.Root className="sw" checked={v.showOnline} aria-label={`Show ${s.name} online`} onCheckedChange={(c) => { const next = { ...v, showOnline: c }; setV(next); save(next); }} />
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {dirty && <button className="btn btn-red btn-sm" disabled={pending} onClick={() => save()}>Save</button>}
        {msg && !dirty && <span style={{ color: msg === "Saved" ? "#2e6b43" : "#8e1b22", fontSize: 12 }}>{msg}</span>}
      </span>
    </div>
  );
}

export function ServicesEditor({ services }: { services: ServiceRowData[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="tbl">
        <div className="tr h" style={cols}><span>Service</span><span>Price</span><span>Minutes</span><span>Shown as</span><span>Show online</span><span /></div>
        {services.map((s) => <Row key={s.id + JSON.stringify(s)} s={s} />)}
      </div>
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const n = name; setName(""); start(async () => { await createServiceAction({ name: n }); }); }}>
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="New service name" aria-label="New service name" style={{ width: 260 }} />
        <button className="btn btn-ink btn-sm" type="submit" disabled={!name.trim() || pending}>Add service</button>
      </form>
    </div>
  );
}
