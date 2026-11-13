import type { Metadata } from "next";
import { RescheduleForm } from "@/components/site/RescheduleForm";
import { toHoursRows } from "@/lib/availability/load";
import { openDays } from "@/lib/availability/slots";
import { getBookingView } from "@/lib/booking/view";
import { getHours, getShop } from "@/lib/data/public";
import { verifyToken } from "@/lib/tokens";
import { InvalidLink } from "@/components/site/InvalidLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reschedule", robots: { index: false } };

export default async function ReschedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = verifyToken(token, "booking");
  const b = t ? await getBookingView(t.id) : null;
  if (!b) return <InvalidLink />;
  const [shop, hours] = await Promise.all([getShop(), getHours()]);
  const days = openDays(new Date(), shop.timezone, shop.booking_window_days, toHoursRows(hours).filter((h) => h.barberId === null), 14);
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="wrap" style={{ maxWidth: 700 }}>
        <div className="card">
          <p className="kick">Reschedule</p>
          <h1 className="q">{b.serviceName} with {b.barberName}</h1>
          <p className="lede" style={{ marginBottom: 20 }}>Now: <b>{b.whenLabel}</b>. Pick a new time below.</p>
          {b.canChange ? <RescheduleForm token={token} serviceId={b.serviceId} barberId={b.barberId} days={days} tz={shop.timezone} /> : <p className="form-error">This booking can&apos;t be changed online any more. Please call the shop.</p>}
        </div>
      </div>
    </section>
  );
}
