import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/site/BookingWizard";
import { openDays } from "@/lib/availability/slots";
import { toHoursRows } from "@/lib/availability/load";
import { getBarberServices, getBarbers, getHours, getServices, getShop } from "@/lib/data/public";

export const revalidate = 60;
export const metadata: Metadata = { title: "Book a chair", description: "Pick your service, barber and time. Real openings, booked in under a minute." };

export default async function BookPage() {
  const [shop, services, barbers, links, hours] = await Promise.all([getShop(), getServices(), getBarbers(), getBarberServices(), getHours()]);
  const days = openDays(new Date(), shop.timezone, shop.booking_window_days, toHoursRows(hours).filter((h) => h.barberId === null), 14);
  return (
    <>
      <section className="page-head dark"><div className="wrap"><p className="kick">Book</p><h1 className="h2">Book a chair, <em>in four taps.</em></h1></div></section>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <Suspense fallback={<div className="card" style={{ minHeight: 420 }} aria-busy="true" />}>
            <BookingWizard
              tz={shop.timezone}
              days={days}
              services={services.map((s) => ({ id: s.id, name: s.name, label: s.duration_label ?? `${s.duration_minutes} min`, price_cents: s.price_cents }))}
              barbers={barbers.map((b) => ({ id: b.id, name: b.name, initials: b.initials, serviceIds: links.filter((l) => l.barber_id === b.id).map((l) => l.service_id) }))}
            />
          </Suspense>
        </div>
      </section>
    </>
  );
}
