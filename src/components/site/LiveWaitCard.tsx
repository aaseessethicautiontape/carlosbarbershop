"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { openStatus, type ShopHour } from "@/lib/hours";
import { useQueueState, type QueueRow } from "./useQueueState";

interface Props { shopId: string; tz: string; hours: ShopHour[]; initial: QueueRow | null; variant?: "pill" | "card" }

const waitText = (q: QueueRow | null) => {
  if (!q) return "Checking the line…";
  if (q.on_duty_count === 0) return "No barbers on right now";
  if (q.waiting_count === 0) return "No wait right now";
  return `${q.waiting_count} waiting · about ${q.est_wait_min ?? 0} min`;
};

/** The pitch: how long is the line RIGHT NOW. Names are never shown; it only reads queue_state. */
export function LiveWaitCard({ shopId, tz, hours, initial, variant = "pill" }: Props) {
  const q = useQueueState(shopId, initial);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const st = now ? openStatus(now, tz, hours) : null;
  const dot = st && !st.open ? "dot off" : "dot";
  const line = st ? (st.open ? `Open until ${st.closesAt}` : `Closed · opens ${st.nextOpen}`) : "Hours below";

  if (variant === "pill") {
    return (
      <div className="status up d2" role="status" aria-live="polite" style={{ minHeight: 44 }}>
        <span className={dot} aria-hidden="true" />
        <span>{line} · {waitText(q)}</span>
      </div>
    );
  }
  const slots = Array.from({ length: 6 }, (_, i) => (i === 0 ? "Chair" : i <= (q?.waiting_count ?? 0) ? `#${i}` : ""));
  return (
    <div className="walk" aria-live="polite">
      <span className="live"><span className={dot} aria-hidden="true" />Live walk-in line</span>
      <div className="qline" aria-hidden="true">
        {slots.map((l, i) => <i key={i} className={i === 0 ? "chair" : ""}>{l}</i>)}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        <span className="big">{q?.est_wait_min ?? "–"}</span>
        <span style={{ color: "var(--c-muted-dark)", paddingBottom: 6 }}>min wait right now<br />{q ? `${q.waiting_count} ${q.waiting_count === 1 ? "person" : "people"} ahead` : ""}</span>
      </div>
      <Link className="btn btn-red" href="/line">Join the line</Link>
    </div>
  );
}
