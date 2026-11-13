"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/line", label: "Walk-ins" },
  { href: "/barbers", label: "Barbers" },
  { href: "/visit", label: "Visit" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="navlinks" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(l.href + "/") ? "page" : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
