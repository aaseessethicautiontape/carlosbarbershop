import { BarbersEditor, type BarberData } from "@/components/admin/BarbersEditor";
import { localDay } from "@/lib/availability/tz";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Barbers" };

export default async function BarbersAdminPage() {
  await requireStaff(["owner"]);
  const shop = await getShop();
  const db = await userClient();
  const [{ data: barbers }, { data: services }, { data: links }, { data: hours }, { data: off }] = await Promise.all([
    db.from("barbers").select("*").order("sort_order").order("name"),
    db.from("services").select("id, name").order("sort_order"),
    db.from("barber_services").select("barber_id, service_id"),
    db.from("working_hours").select("*").not("barber_id", "is", null),
    db.from("time_off").select("id, barber_id, starts_at, ends_at, reason").gte("ends_at", new Date().toISOString()).order("starts_at"),
  ]);
  const fmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: shop.timezone });
  const data: BarberData[] = (barbers ?? []).map((b) => ({
    id: b.id, name: b.name, initials: b.initials, bio: b.bio ?? "", isPublished: b.is_published,
    serviceIds: (links ?? []).filter((l) => l.barber_id === b.id).map((l) => l.service_id),
    days: [0, 1, 2, 3, 4, 5, 6].map((wd) => {
      const row = (hours ?? []).find((h) => h.barber_id === b.id && h.weekday === wd);
      return { weekday: wd, mode: !row ? "shop" : row.is_off ? "off" : "custom", opens: row?.opens.slice(0, 5) ?? "09:00", closes: row?.closes.slice(0, 5) ?? "17:00" };
    }),
    timeOff: (off ?? []).filter((t) => t.barber_id === b.id).map((t) => {
      const last = new Date(new Date(t.ends_at).getTime() - 1);
      const a = fmt.format(new Date(t.starts_at)), z = fmt.format(last);
      return { id: t.id, label: a === z ? a : `${a} to ${z}`, reason: t.reason };
    }),
  }));
  return (
    <>
      <header className="top"><div><h1>Barbers</h1><small>Details, services, weekly hours and days off. Hidden barbers can&apos;t be booked.</small></div></header>
      <div className="body" style={{ maxWidth: 900 }}>
        <BarbersEditor barbers={data} services={services ?? []} today={localDay(new Date(), shop.timezone)} />
      </div>
    </>
  );
}
