import type { Metadata } from "next";
import Link from "next/link";
import { CancelButton } from "@/components/site/CancelButton";
import { addressOneLine } from "@/content/site";
import { getBookingView } from "@/lib/booking/view";
import { verifyToken } from "@/lib/tokens";
import { InvalidLink } from "@/components/site/InvalidLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = verifyToken(token, "booking");
  const b = t ? await getBookingView(t.id) : null;
  if (!b) return <InvalidLink />;
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="wrap" style={{ maxWidth: 620 }}>
        <div className="card">
          <p className="kick">Your booking</p>
          <h1 className="q">{b.serviceName} with {b.barberName}</h1>
          <p style={{ margin: "0 0 6px", fontSize: 18 }}><b>{b.whenLabel}</b></p>
          <p className="lede" style={{ marginBottom: 18 }}>{addressOneLine} · {b.priceLabel} at the shop</p>
          {b.status === "cancelled" && <p className="form-error">This booking was cancelled.</p>}
          {b.status === "booked" && !b.canChange && <p className="lede">This appointment has already started or passed.</p>}
          {b.canChange && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn btn-ghost" href={`/api/calendar/${token}`}>Add to calendar</a>
              <Link className="btn btn-ink" href={`/b/${token}/reschedule`}>Reschedule</Link>
              <CancelButton token={token} />
            </div>
          )}
          {b.status !== "booked" && <div style={{ marginTop: 18 }}><Link className="btn btn-red" href="/book">Book again</Link></div>}
        </div>
      </div>
    </section>
  );
}
