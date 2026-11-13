"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ owner, mock, queueCount }: { owner: boolean; mock: boolean; queueCount: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Today", count: 0, show: true },
    { href: "/admin/queue", label: "Walk-in line", count: queueCount, show: true },
    { href: "/admin/clients", label: "Clients", count: 0, show: true },
    { href: "/admin/services", label: "Services & prices", count: 0, show: owner },
    { href: "/admin/barbers", label: "Barbers", count: 0, show: owner },
    { href: "/admin/messages", label: "Emails & texts", count: 0, show: owner },
    { href: "/admin/settings", label: "Settings", count: 0, show: owner },
    { href: "/admin/outbox", label: "Outbox (dev log)", count: 0, show: mock },
  ];
  return (
    <nav aria-label="Admin" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.filter((i) => i.show).map((i) => {
        const on = i.href === "/admin" ? path === "/admin" : path === i.href || path.startsWith(i.href + "/");
        return <Link key={i.href} href={i.href} className={on ? "nv on" : "nv"} aria-current={on ? "page" : undefined}>{i.label}{i.count > 0 && <span className="cnt">{i.count}</span>}</Link>;
      })}
    </nav>
  );
}
