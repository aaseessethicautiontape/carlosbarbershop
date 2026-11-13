import Image from "next/image";
import Link from "next/link";
import { BarberGrid } from "@/components/site/BarberGrid";
import { HoursCard } from "@/components/site/HoursCard";
import { LiveWaitCard } from "@/components/site/LiveWaitCard";
import { MenuBoard } from "@/components/site/MenuBoard";
import { ReviewQuotes } from "@/components/site/ReviewQuotes";
import { site } from "@/content/site";
import { getBarbers, getHours, getQueueState, getServices, getShop, shopHours } from "@/lib/data/public";

// Static page, refreshed in the background every minute. Live bits are small client islands.
export const revalidate = 60;

export default async function HomePage() {
  const [shop, services, barbers, hours] = await Promise.all([getShop(), getServices(), getBarbers(), getHours()]);
  const queue = await getQueueState(shop.id);
  const sh = shopHours(hours);
  const initial = queue ? { waiting_count: queue.waiting_count, on_duty_count: queue.on_duty_count, free_chairs: queue.free_chairs, est_wait_min: queue.est_wait_min } : null;

  return (
    <>
      <section className="hero dark">
        <div className="pillar l" aria-hidden="true" />
        <div className="pillar r" aria-hidden="true" />
        <div className="wrap heroin">
          <Image className="biglogo" src="/brand/carlos-logo.png" alt="Carlo's Barbershop, cuts and shaves" width={440} height={426} priority quality={60} sizes="(max-width: 819px) 290px, 440px" />
          <h1 className="h1">Cuts &amp; shaves on Bayfield,<br /><em>since {site.since}.</em></h1>
          <LiveWaitCard shopId={shop.id} tz={shop.timezone} hours={sh} initial={initial} />
          <div className="up d3" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <Link className="btn btn-red" href="/book">Book a chair</Link>
            <Link className="btn btn-line" href="/line">Join the line</Link>
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="track">
          {[...site.ticker, ...site.ticker].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <section className="section" id="services">
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30, flexWrap: "wrap", marginBottom: 44 }}>
            <div><p className="kick">The menu</p><h2 className="h2">Honest prices, <em>proper cuts.</em></h2></div>
            <p className="lede" style={{ maxWidth: 400 }}>Every cut comes with a neck shave and a clean finish. Pick a service to book it straight away.</p>
          </div>
          <MenuBoard services={services} />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="kick">Two ways in</p>
          <h2 className="h2">Book a time, <em>or join the line.</em></h2>
          <div className="ways">
            <div className="card">
              <p className="q">Pick a chair, pick a time.</p>
              <p className="lede" style={{ marginBottom: 22 }}>Choose your service and barber, see real openings, and you&apos;re booked in under a minute. You&apos;ll get a confirmation and a reminder. Pay at the shop.</p>
              <Link className="btn btn-red" href="/book">Book a chair</Link>
            </div>
            <div>
              <LiveWaitCard variant="card" shopId={shop.id} tz={shop.timezone} hours={sh} initial={initial} />
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--c-paper-2)" }} id="barbers">
        <div className="wrap">
          <p className="kick">The chairs</p>
          <h2 className="h2">Seven barbers, <em>one standard.</em></h2>
          <BarberGrid barbers={barbers} />
        </div>
      </section>

      <ReviewQuotes />

      <section className="section" id="visit">
        <div className="wrap">
          <p className="kick">Visit</p>
          <h2 className="h2">{site.address.line1}, <em>{site.address.city}.</em></h2>
          <div className="visit">
            <HoursCard hours={sh} tz={shop.timezone} />
            <div className="map">
              <div className="grid" aria-hidden="true" /><div className="pin" aria-hidden="true" />
              <div style={{ fontSize: 18, lineHeight: 1.6 }}>{site.address.line1}<br />{site.address.city}, {site.address.region} {site.address.postal}</div>
              <a href={site.phoneHref} style={{ color: "var(--c-brass)", font: "600 22px var(--font-label)", letterSpacing: ".08em", textDecoration: "none" }}>{site.phoneDisplay}</a>
              <a href={`mailto:${site.email}`} style={{ color: "var(--c-text-dark)" }}>{site.email}</a>
              <a className="btn btn-red" href={site.googleMapsDirections} rel="noopener noreferrer" style={{ alignSelf: "flex-start", marginTop: "auto" }}>Get directions</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
