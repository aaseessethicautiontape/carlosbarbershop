import Link from "next/link";
import { DayCalendar, type CalBooking } from "@/components/admin/DayCalendar";
import { addDays, isDay, localDay, weekdayOf, zoned } from "@/lib/availability/tz";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { isMock } from "@/lib/env";
import { iso } from "@/lib/db";
import { formatClock, formatPhone, formatPrice } from "@/lib/format";
import { loadQueue } from "@/lib/admin/queue";
import { one, q } from "@/lib/db";

export const metadata = { title: "Today" };

const minutesOfDay = (iso: string, tz: string) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  return Number(p.find((x) => x.type === "hour")!.value) * 60 + Number(p.find((x) => x.type === "minute")!.value);
};

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string; denied?: string }> }) {
  const staff = await requireStaff();
  const shopId = staff.profile.shop_id;
  const sp = await searchParams;
  const shop = await getShop();
  const today = localDay(new Date(), shop.timezone);
  const day = sp.d && isDay(sp.d) ? sp.d : today;
  const hoursRows = await one<{ opens: string; closes: string; is_off: boolean }>("select opens, closes, is_off from working_hours where shop_id = $1 and barber_id is null and weekday = $2", [shopId, weekdayOf(day)]);
  const closed = !hoursRows || hoursRows.is_off;

  // Mock mode only: keep the demo calendar alive by filling an empty open day with sample bookings.
  if (isMock() && !closed) await q("select public.demo_fill_day($1::uuid, $2::date)", [shopId, day]);

  const from = zoned(day, 0, shop.timezone).toISOString();
  const to = zoned(addDays(day, 1), 0, shop.timezone).toISOString();
  const [barbers, bks, queue] = await Promise.all([
    q<{ id: string; name: string; on_duty: boolean }>("select id, name, on_duty from barbers where shop_id = $1 order by sort_order", [shopId]),
    q<{ id: string; barber_id: string; starts_at: unknown; ends_at: unknown; status: string; source: string; notes: string | null; price_cents_snapshot: number | null; service_name: string | null; client_name: string | null; client_phone: string | null }>(
      `select b.id, b.barber_id, b.starts_at, b.ends_at, b.status, b.source, b.notes, b.price_cents_snapshot, s.name as service_name, c.name as client_name, c.phone as client_phone
       from bookings b left join services s on s.id = b.service_id left join clients c on c.id = b.client_id
       where b.shop_id = $1 and b.starts_at >= $2::timestamptz and b.starts_at < $3::timestamptz and b.status <> 'cancelled' order by b.starts_at`, [shopId, from, to]),
    loadQueue(shopId),
  ]);

  const startHour = hoursRows ? Math.floor(Number(hoursRows.opens.slice(0, 2))) : 9;
  const endHour = hoursRows ? Math.ceil(Number(hoursRows.closes.slice(0, 2)) + Number(hoursRows.closes.slice(3, 5)) / 60) : 18;
  const list: CalBooking[] = bks.map((b) => {
    const startsAt = iso(b.starts_at); const endsAt = iso(b.ends_at);
    const cl = b.client_name ? { name: b.client_name, phone: b.client_phone } : null;
    return {
      id: b.id,
      barberId: b.barber_id,
      startMin: minutesOfDay(startsAt, shop.timezone),
      durMin: Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000),
      client: b.source === "walk_in" && cl ? `${cl.name} (walk-in)` : (cl?.name ?? "Client"),
      phone: cl?.phone ? formatPhone(cl.phone) : null,
      service: b.service_name ?? "",
      status: b.status,
      source: b.source,
      price: formatPrice(b.price_cents_snapshot),
      note: b.notes,
      timeLabel: formatClock(startsAt, shop.timezone),
      barberName: barbers.find((x) => x.id === b.barber_id)?.name ?? "",
    };
  });

  const active = list.filter((b) => b.status !== "no_show");
  const priced = bks.filter((b) => b.status !== "no_show" && b.price_cents_snapshot !== null);
  const revenue = priced.length ? `$${Math.round(priced.reduce((a, b) => a + (b.price_cents_snapshot ?? 0), 0) / 100).toLocaleString()}` : "—";
  const onCount = barbers.filter((b) => b.on_duty).length;
  const label = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

  return (
    <>
      <header className="top">
        <div>
          <h1>{day === today ? "Today" : label}</h1>
          <small>{label}{isMock() ? " · sample data" : ""}</small>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="btn btn-ghost btn-sm" href={`/admin?d=${addDays(day, -1)}`} aria-label="Previous day">‹ Prev</Link>
          {day !== today && <Link className="btn btn-ghost btn-sm" href="/admin">Today</Link>}
          <Link className="btn btn-ghost btn-sm" href={`/admin?d=${addDays(day, 1)}`} aria-label="Next day">Next ›</Link>
        </div>
      </header>
      <div className="body">
        {sp.denied && <p className="form-error">That page is for the owner only.</p>}
        <div className="kpis">
          <div className="kpi"><span>Booked</span><b>{active.length}</b><small>{list.filter((b) => b.status === "done").length} done so far</small></div>
          <div className="kpi"><span>Walk-ins waiting</span><b>{queue.items.length}</b><small>live</small></div>
          <div className="kpi"><span>Chairs working</span><b>{onCount} of {barbers.length}</b><small>tap a name to switch</small></div>
          <div className="kpi"><span>Expected</span><b>{revenue}</b><small>{revenue === "—" ? "set prices in Services" : "from bookings, before tips"}</small></div>
        </div>
        {closed ? (
          <p className="card-a">The shop is closed this day. <Link href={`/admin?d=${addDays(day, 1)}`}>Next day →</Link></p>
        ) : (
          <DayCalendar
            barbers={barbers.map((b) => ({ id: b.id, name: b.name, onDuty: b.on_duty }))}
            bookings={list}
            queue={queue.items}
            chairs={queue.chairs}
            startHour={startHour}
            endHour={endHour}
            nowMin={day === today ? minutesOfDay(new Date().toISOString(), shop.timezone) : null}
            tz={shop.timezone}
          />
        )}
      </div>
    </>
  );
}
