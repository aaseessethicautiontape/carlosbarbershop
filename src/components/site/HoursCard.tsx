"use client";
import { useEffect, useState } from "react";
import { hoursRows, localParts, openStatus, type ShopHour } from "@/lib/hours";

/** Weekly hours with today highlighted (computed after mount so the page itself can stay static). */
export function HoursCard({ hours, tz }: { hours: ShopHour[]; tz: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const today = now ? localParts(now, tz).weekday : -1;
  const st = now ? openStatus(now, tz, hours) : null;
  return (
    <div className="card">
      <div className="status light" style={{ minHeight: 44 }}>
        <span className={st && !st.open ? "dot off" : "dot"} aria-hidden="true" />
        <span>{st ? (st.open ? `Open now until ${st.closesAt}` : `Closed now${st.nextOpen ? ` · opens ${st.nextOpen}` : ""}`) : "Opening hours"}</span>
      </div>
      {hoursRows(hours).map((r) => (
        <div key={r.weekday} className={r.weekday === today ? "hrow today" : "hrow"}>
          <span>{r.day}</span><span>{r.time}</span>
        </div>
      ))}
      <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--c-muted)" }}>Closed on all major holidays. Can&apos;t make it? Please let us know so someone else can take your spot.</p>
    </div>
  );
}
