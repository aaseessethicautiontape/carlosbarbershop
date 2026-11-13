"use client";
import { useState, useTransition } from "react";
import { runRemindersNowAction } from "@/app/admin/(app)/outbox/actions";

export function RunRemindersButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await runRemindersNowAction(); setMsg(r.ok ? `Sent ${r.r24} day-before and ${r.r2} 2-hour reminders` : r.error); })}>Run reminders now</button>
      {msg && <span role="status" style={{ color: "var(--a-mute)" }}>{msg}</span>}
    </div>
  );
}
