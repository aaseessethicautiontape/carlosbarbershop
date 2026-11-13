"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { leaveLineAction } from "@/app/(site)/line/actions";
import { useQueueState, type QueueRow } from "./useQueueState";

export interface TicketState { status: "waiting" | "seated" | "removed" | "left"; position: number | null; estWaitMin: number | null; firstName: string }

/** "You're #3". Follows Realtime on queue_state, then re-asks the server for YOUR ticket only. */
export function LineStatus({ token, shopId, initial, initialQueue }: { token: string; shopId: string; initial: TicketState; initialQueue: QueueRow | null }) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [pending, start] = useTransition();
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/line/${token}`, { cache: "no-store" });
    if (res.ok) { const j = await res.json(); setT({ status: j.status, position: j.position, estWaitMin: j.estWaitMin, firstName: j.firstName }); }
  }, [token]);
  const q = useQueueState(shopId, initialQueue, refresh);
  useEffect(() => { const i = setInterval(refresh, 30_000); return () => clearInterval(i); }, [refresh]);

  const total = Math.max(q?.waiting_count ?? 0, t.position ?? 0);
  const strip = Array.from({ length: 6 }, (_, i) => (i === 0 ? "Chair" : t.position === i ? "You" : i <= total ? `#${i}` : ""));

  return (
    <div className="walk" aria-live="polite">
      <span className="live"><span className="dot" aria-hidden="true" />Live</span>
      {t.status === "waiting" && (
        <>
          <h1 className="pf" style={{ fontSize: 40, margin: "12px 0 4px", fontWeight: 700 }}>You&apos;re #{t.position}, {t.firstName}.</h1>
          <div className="qline" aria-hidden="true">{strip.map((l, i) => <i key={i} className={i === 0 ? "chair" : l === "You" ? "me" : ""}>{l}</i>)}</div>
          <p style={{ margin: "0 0 18px", color: "var(--c-text-dark)", fontSize: 18, lineHeight: 1.6 }}>
            {t.position === 1 && (t.estWaitMin ?? 0) === 0 ? <>You&apos;re <b>next</b>. Head over now.</> : <>About <b>{t.estWaitMin ?? "–"} minutes</b>. We&apos;ll text you when you&apos;re next. Keep this page open to watch the line move.</>}
          </p>
          <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(async () => { const fd = new FormData(); fd.set("token", token); await leaveLineAction(fd); await refresh(); router.refresh(); })}>Leave the line</button>
        </>
      )}
      {t.status === "seated" && (<><h1 className="pf" style={{ fontSize: 40, margin: "12px 0 8px" }}>You&apos;re up, {t.firstName}!</h1><p style={{ margin: 0, fontSize: 18 }}>Your barber is ready. Come on in.</p></>)}
      {(t.status === "removed" || t.status === "left") && (
        <>
          <h1 className="pf" style={{ fontSize: 34, margin: "12px 0 8px" }}>You&apos;re off the line.</h1>
          <p style={{ margin: "0 0 18px" }}>{t.status === "left" ? "No problem." : "The front desk took you off the line."} You can join again or book a time.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link className="btn btn-red" href="/line">Join again</Link><Link className="btn btn-line" href="/book">Book a time</Link></div>
        </>
      )}
    </div>
  );
}
