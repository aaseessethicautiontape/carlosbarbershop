"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinLineAction } from "@/app/(site)/line/actions";
import { HONEYPOT_FIELD } from "@/lib/turnstile-shared";
import { TurnstileField } from "./TurnstileField";

export function JoinLineForm({ services }: { services: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form className="walk" noValidate onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null); setFields({});
      start(async () => {
        const r = await joinLineAction(fd);
        if (r.ok) router.push(`/line/${r.token}`); else { setError(r.error); setFields(r.fields ?? {}); }
      });
    }}>
      <div className="stripe" aria-hidden="true" />
      <h2 className="pf" style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>Join the line</h2>
      <p style={{ margin: "0 0 18px", color: "var(--c-muted-dark)", fontSize: 15, lineHeight: 1.6 }}>Wait at home, not in the chair. We&apos;ll text you when you&apos;re next.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">Your first name<input name="name" autoComplete="given-name" required placeholder="First name" />{fields.name && <span className="err" style={{ color: "#ff9aa0" }}>{fields.name}</span>}</label>
        <label className="field">Phone, for the text<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="705 555 0123" />{fields.phone && <span className="err" style={{ color: "#ff9aa0" }}>{fields.phone}</span>}</label>
        <label className="field">What are you in for? (optional)
          <select name="serviceId" defaultValue="" style={{ background: "var(--c-ink-2)", color: "var(--c-text-dark)", borderColor: "#3a3230" }}>
            <option value="">Not sure yet</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="hp" aria-hidden="true"><label>Leave this empty<input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" /></label></div>
        <TurnstileField />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-red" type="submit" disabled={pending}>{pending ? "Adding you…" : "Join the line"}</button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-muted-dark)" }}>Your name and number are only used for this visit and are never shown to other customers.</p>
      </div>
    </form>
  );
}
