import Link from "next/link";
import { DayCalendar, type CalBooking } from "@/components/admin/DayCalendar";
import { addDays, isDay, localDay, weekdayOf, zoned } from "@/lib/availability/tz";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { isMock } from "@/lib/env";
import { formatClock, formatPhone, formatPrice } from "@/lib/format";
import { loadQueue } from "@/lib/admin/queue";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Today" };

const minutesOfDay = (iso: string, tz: string) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  return Number(p.find((x) => x.type === "hour")!.value) * 60 + Number(p.find((x) => x.type === "minute")!.value);
};

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string; denied?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const shop = await getShop();
  const today = localDay(new Date(), shop.timezone);
  const day = sp.d && isDay(sp.d) ? sp.d : today;
  const db = await userClient();

  const { data: hoursRows } = await db.from("working_hours").select("opens, closes, is_off").is("barber_id", null).eq("weekday", weekdayOf(day)).maybeSingle();
  const closed = !hoursRows || hoursRows.is_off;

  // Mock mode only: keep the demo calendar alive by filling an empty open day with sample bookings.
  if (isMock() && !closed) await adminClient().rpc("demo_fill_day", { p_shop: shop.id, p_day: day });

  const from = zoned(day, 0, shop.timezone).toISOString();
  const to = zoned(addDays(day, 1), 0, shop.timezone).toISOString();
  const [{ data: barbers }, { data: bks }, queue] = await Promise.all([
    db.from("barbers").select("id, name, on_duty").order("sort_order"),
    db
      .from("bookings")
      .select("id, barber_id, starts_at, ends_at, status, source, notes, price_cents_snapshot, services(name), clients(name, phone)")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .neq("status", "cancelled")
      .order("starts_at"),
    loadQueue(),
  ]);

  const startHour = hoursRows ? Math.floor(Number(hoursRows.opens.slice(0, 2))) : 9;
  const endHour = hoursRows ? Math.ceil(Number(hoursRows.closes.slice(0, 2)) + Number(hoursRows.closes.slice(3, 5)) / 60) : 18;
  const list: CalBooking[] = (bks ?? []).map((b) => {
    const svc = b.services as unknown as { name: string } | null;
    const cl = b.clients as unknown as { name: string; phone: string | null } | null;
    return {
      id: b.id,
      barberId: b.barber_id,
      startMin: minutesOfDay(b.starts_at, shop.timezone),
      durMin: Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000),
      client: b.source === "walk_in" && cl ? `${cl.name} (walk-in)` : (cl?.name ?? "Client"),
      phone: cl?.phone ? formatPhone(cl.phone) : null,
      service: svc?.name ?? "",
      status: b.status,
      source: b.source,
      price: formatPrice(b.price_cents_snapshot),
      note: b.notes,
      timeLabel: formatClock(b.starts_at, shop.timezone),
      barberName: (barbers ?? []).find((x) => x.id === b.barber_id)?.name ?? "",
    };
  });

  const active = list.filter((b) => b.status !== "no_show");
  const priced = (bks ?? []).filter((b) => b.status !== "no_show" && b.price_cents_snapshot !== null);
  const revenue = priced.length ? `$${Math.round(priced.reduce((a, b) => a + (b.price_cents_snapshot ?? 0), 0) / 100).toLocaleString()}` : "—";
  const onCount = (barbers ?? []).filter((b) => b.on_duty).length;
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
          <div className="kpi"><span>Chairs working</span><b>{onCount} of {(barbers ?? []).length}</b><small>tap a name to switch</small></div>
          <div className="kpi"><span>Expected</span><b>{revenue}</b><small>{revenue === "—" ? "set prices in Services" : "from bookings, before tips"}</small></div>
        </div>
        {closed ? (
          <p className="card-a">The shop is closed this day. <Link href={`/admin?d=${addDays(day, 1)}`}>Next day →</Link></p>
        ) : (
          <DayCalendar
            barbers={(barbers ?? []).map((b) => ({ id: b.id, name: b.name, onDuty: b.on_duty }))}
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
