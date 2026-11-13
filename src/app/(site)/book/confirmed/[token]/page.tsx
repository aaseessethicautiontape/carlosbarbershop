import type { Metadata } from "next";
import Link from "next/link";
import { InvalidLink } from "@/components/site/InvalidLink";
import { CheckIcon } from "@/components/ui/Icons";
import { addressOneLine } from "@/content/site";
import { getBookingView } from "@/lib/booking/view";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You're booked", robots: { index: false } };

export default async function ConfirmedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = verifyToken(token, "booking");
  const b = t ? await getBookingView(t.id) : null;
  if (!b) return <InvalidLink />;
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="wrap" style={{ maxWidth: 620 }}>
        <div className="card done-box">
          <div className="tick"><CheckIcon /></div>
          <h1 className="q" style={{ margin: 0 }}>You&apos;re booked, {b.clientFirst || "friend"}.</h1>
          <p style={{ margin: 0, color: "#4b4035", lineHeight: 1.6 }}>{b.serviceName} with {b.barberName}<br /><b>{b.whenLabel}</b> · {addressOneLine}</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--c-muted)" }}>{b.clientEmail ? `Confirmation sent to ${b.clientEmail}.` : "Save this page: it's your link to change or cancel."} Pay at the shop.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <a className="btn btn-red" href={`/api/calendar/${token}`}>Add to calendar</a>
            <Link className="btn btn-ghost" href={`/b/${token}/reschedule`}>Reschedule</Link>
            <Link className="btn btn-ghost" href={`/b/${token}`}>Cancel</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
