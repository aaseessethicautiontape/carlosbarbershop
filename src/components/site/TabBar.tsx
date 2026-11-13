"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ClockIcon, HomeIcon, PinIcon } from "@/components/ui/Icons";

/** Phone-only fixed bottom tab bar (shown by CSS under 820px): Home, Book, Line, Visit. */
export function TabBar() {
  const path = usePathname();
  const cur = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/") ? "page" : undefined);
  const item = (href: string) => (href === "/" ? (path === "/" ? "page" : undefined) : cur(href));
  return (
    <nav className="tabbar" aria-label="Quick menu">
      <Link className="tab" href="/" aria-current={item("/")}><HomeIcon />Home</Link>
      <Link className="tab main" href="/book" aria-current={item("/book")}><span className="b"><CalendarIcon /></span>Book</Link>
      <Link className="tab" href="/line" aria-current={item("/line")}><ClockIcon />Line</Link>
      <Link className="tab" href="/visit" aria-current={item("/visit")}><PinIcon />Visit</Link>
    </nav>
  );
}
