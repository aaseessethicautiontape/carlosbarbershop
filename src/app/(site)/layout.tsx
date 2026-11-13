import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "@/components/site/NavLinks";
import { TabBar } from "@/components/site/TabBar";
import { site } from "@/content/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="pole" aria-hidden="true" />
      <header className="nav">
        <div className="wrap navin">
          <Link href="/" aria-label="Carlo's Barbershop home" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <Image src="/brand/carlos-logo-web.png" alt="" width={54} height={52} sizes="54px" />
            <span className="os" style={{ color: "var(--c-text-dark)", fontSize: 15 }}>Carlo&apos;s Barbershop</span>
          </Link>
          <NavLinks />
          <Link className="btn btn-red navcta" href="/book" style={{ minHeight: 46 }}>Book a cut</Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="foot">
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", gap: 30, flexWrap: "wrap", alignItems: "center" }}>
          <Image src="/brand/carlos-logo-web.png" alt="Carlo's Barbershop" width={150} height={145} sizes="150px" />
          <div className="os" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/services">Services</Link><Link href="/book">Book</Link><Link href="/line">Line</Link>
            <a href={site.instagram} rel="noopener noreferrer">Instagram</a><a href={site.facebook} rel="noopener noreferrer">Facebook</a>
          </div>
          <span style={{ fontSize: 13 }}>© {new Date().getFullYear()} {site.name}</span>
        </div>
      </footer>
      <TabBar />
    </>
  );
}
