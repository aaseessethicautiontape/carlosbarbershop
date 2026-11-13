import type { Metadata } from "next";
import { HoursCard } from "@/components/site/HoursCard";
import { site } from "@/content/site";
import { getHours, getShop, shopHours } from "@/lib/data/public";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Visit", description: "Hours, map and contact for Carlo's Barbershop, 331 Bayfield St, Barrie." };

export default async function VisitPage() {
  const [shop, hours] = await Promise.all([getShop(), getHours()]);
  return (
    <>
      <section className="page-head dark"><div className="wrap"><p className="kick">Visit</p><h1 className="h2">{site.address.line1}, <em>{site.address.city}.</em></h1></div></section>
      <section className="section" style={{ paddingTop: 56 }}>
        <div className="wrap">
          <div className="visit" style={{ marginTop: 0 }}>
            <HoursCard hours={shopHours(hours)} tz={shop.timezone} />
            <div className="map">
              <div className="grid" aria-hidden="true" />
              <div style={{ fontSize: 18, lineHeight: 1.6 }}>{site.address.line1}<br />{site.address.city}, {site.address.region} {site.address.postal}</div>
              <a href={site.phoneHref} style={{ color: "var(--c-brass)", font: "600 22px var(--font-label)", letterSpacing: ".08em", textDecoration: "none" }}>{site.phoneDisplay}</a>
              <a href={`mailto:${site.email}`} style={{ color: "var(--c-text-dark)" }}>{site.email}</a>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a href={site.instagram} rel="noopener noreferrer" style={{ color: "var(--c-text-dark)" }}>Instagram</a>
                <a href={site.facebook} rel="noopener noreferrer" style={{ color: "var(--c-text-dark)" }}>Facebook</a>
              </div>
              <a className="btn btn-red" href={site.googleMapsDirections} rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>Get directions</a>
            </div>
          </div>
          <iframe title="Map of Carlo's Barbershop" src={site.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            style={{ width: "100%", height: 380, border: 0, borderRadius: 12, marginTop: 24 }} />
        </div>
      </section>
    </>
  );
}
