"use client";
import { useState, useTransition } from "react";
import { demoLoginAction, passwordLoginAction } from "@/app/admin/login/actions";

export function LoginForms({ mock }: { mock: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {mock && (
        <div className="demo-box">
          <p style={{ margin: "0 0 10px", fontSize: 13 }}><b>Mock mode.</b> Sign in as a seeded demo account.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["owner", "barber"] as const).map((who) => (
              <button key={who} className="btn btn-red" disabled={pending} onClick={() => start(async () => {
                const fd = new FormData(); fd.set("who", who);
                const r = await demoLoginAction(fd);
                if (r && !r.ok) setMsg({ ok: false, text: r.error });
              })}>Demo login · {who}</button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await passwordLoginAction(fd); if (r && !r.ok) setMsg({ ok: false, text: r.error }); }); }}>
        <label className="fld">Email<input name="email" type="email" autoComplete="email" required placeholder="you@carlosbarbershop.net" /></label>
        <label className="fld" style={{ marginTop: 10 }}>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn btn-ink" type="submit" disabled={pending} style={{ marginTop: 12 }}>Sign in</button>
      </form>
      {msg && <p role="status" className={msg.ok ? "ok-msg" : "form-error"}>{msg.text}</p>}
    </div>
  );
}
