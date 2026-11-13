"use client";
import { useState, useTransition } from "react";
import { updateClientAction } from "@/app/admin/(app)/clients/actions";

export function ClientEditForm({ client }: { client: { id: string; name: string; email: string; phone: string; notes: string } }) {
  const [v, setV] = useState(client);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form className="card-a" style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateClientAction(v); setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error }); }); }}>
      <label className="fld">Name<input value={v.name} onChange={set("name")} required /></label>
      <div className="grid-a">
        <label className="fld">Phone<input value={v.phone} onChange={set("phone")} placeholder="705 555 0123" /></label>
        <label className="fld">Email<input value={v.email} onChange={set("email")} type="email" /></label>
      </div>
      <label className="fld">Notes (preferences, allergies, usual cut)<textarea value={v.notes} onChange={set("notes")} /></label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn btn-red btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {msg && <span role="status" className={msg.ok ? "ok-msg" : "form-error"} style={{ padding: "6px 10px" }}>{msg.text}</span>}
      </div>
    </form>
  );
}
