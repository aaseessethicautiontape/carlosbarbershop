import { BarbersEditor, type BarberData } from "@/components/admin/BarbersEditor";
import { localDay } from "@/lib/availability/tz";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import type { Row } from "@/lib/dbtypes/types";

export const metadata = { title: "Barbers" };

export default async function BarbersAdminPage() {
  const staff = await requireStaff(["owner"]);
  const shopId = staff.profile.shop_id;
  const shop = await getShop();
  const [barbers, services, links, hours, off] = await Promise.all([
    q<Row<"barbers">>("select * from barbers where shop_id = $1 order by sort_order, name", [shopId]),
    q<{ id: string; name: string }>("select id, name from services where shop_id = $1 order by sort_order", [shopId]),
    q<{ barber_id: string; service_id: string }>("select barber_id, service_id from barber_services"),
    q<Row<"working_hours">>("select * from working_hours where shop_id = $1 and barber_id is not null", [shopId]),
    q<{ id: string; barber_id: string; starts_at: unknown; ends_at: unknown; reason: string | null }>("select id, barber_id, starts_at, ends_at, reason from time_off where shop_id = $1 and ends_at >= now() order by starts_at", [shopId]),
  ]);
  const fmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: shop.timezone });
  const data: BarberData[] = barbers.map((b) => ({
    id: b.id, name: b.name, initials: b.initials, bio: b.bio ?? "", isPublished: b.is_published,
    serviceIds: links.filter((l) => l.barber_id === b.id).map((l) => l.service_id),
    days: [0, 1, 2, 3, 4, 5, 6].map((wd) => {
      const row = hours.find((h) => h.barber_id === b.id && h.weekday === wd);
      return { weekday: wd, mode: !row ? "shop" : row.is_off ? "off" : "custom", opens: row?.opens.slice(0, 5) ?? "09:00", closes: row?.closes.slice(0, 5) ?? "17:00" };
    }),
    timeOff: off.filter((t) => t.barber_id === b.id).map((t) => {
      const last = new Date(new Date(String(t.ends_at)).getTime() - 1);
      const a = fmt.format(new Date(String(t.starts_at))), z = fmt.format(last);
      return { id: t.id, label: a === z ? a : `${a} to ${z}`, reason: t.reason };
    }),
  }));
  return (
    <>
      <header className="top"><div><h1>Barbers</h1><small>Details, services, weekly hours and days off. Hidden barbers can&apos;t be booked.</small></div></header>
      <div className="body" style={{ maxWidth: 900 }}>
        <BarbersEditor barbers={data} services={services} today={localDay(new Date(), shop.timezone)} />
      </div>
    </>
  );
}
