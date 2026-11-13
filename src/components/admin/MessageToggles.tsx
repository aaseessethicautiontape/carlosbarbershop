"use client";
import * as Switch from "@radix-ui/react-switch";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setMessageSettingAction } from "@/app/admin/(app)/manage/actions";

export interface TemplateRow { key: string; label: string; when: string; email: boolean; sms: boolean; selected: boolean }

export function MessageToggles({ rows }: { rows: TemplateRow[] }) {
  const [state, setState] = useState(rows);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const flip = (key: string, ch: "email" | "sms", value: boolean) => {
    const prev = state;
    const next = state.map((r) => (r.key === key ? { ...r, [ch]: value } : r));
    setState(next);
    const r = next.find((x) => x.key === key)!;
    start(async () => { const res = await setMessageSettingAction({ key: key, email: r.email, sms: r.sms }); if (!res.ok) { setErr(res.error); setState(prev); } else setErr(null); });
  };
  return (
    <div className="tbl">
      {state.map((r) => (
        <div className="tr" key={r.key} style={{ ["--tcols" as string]: "1fr auto auto", background: r.selected ? "#fbf1ef" : undefined }}>
          <Link href={`/admin/messages?t=${r.key}`} className="rowlink" aria-current={r.selected ? "true" : undefined}><b>{r.label}</b><br /><small style={{ color: "var(--a-mute)", fontWeight: 400 }}>{r.when}</small></Link>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>Email <Switch.Root className="sw" checked={r.email} onCheckedChange={(c) => flip(r.key, "email", c)} aria-label={`${r.label} by email`} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>Text <Switch.Root className="sw" checked={r.sms} onCheckedChange={(c) => flip(r.key, "sms", c)} aria-label={`${r.label} by text`} /></label>
        </div>
      ))}
      {err && <p className="form-error" role="alert" style={{ margin: 12 }}>{err}</p>}
    </div>
  );
}
