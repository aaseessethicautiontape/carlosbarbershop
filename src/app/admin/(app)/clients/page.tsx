import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { formatPhone } from "@/lib/format";
import { one, q } from "@/lib/db";

export const metadata = { title: "Clients" };
const PAGE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const shop = await getShop();
  // Keep only letters, digits and a few symbols (values are parameterised anyway; this just tidies the search box).
  const term = (sp.q ?? "").replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim().slice(0, 60);
  const page = Math.max(0, Number.parseInt(sp.page ?? "0", 10) || 0);
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const phoneLike = digits ? `%${digits}%` : "\u0000none";
  const where = "c.shop_id = $1 and ($2 = '' or c.name ilike $3 or c.phone ilike $4 or c.email ilike $3)";
  const [list, total] = await Promise.all([
    q<{ id: string; name: string; phone: string | null; email: string | null; visits: number; last_visit: unknown; usual: string | null }>(
      `select c.id, c.name, c.phone, c.email,
              count(b.id) filter (where b.status in ('done','in_chair'))::int as visits,
              max(b.starts_at) filter (where b.status in ('done','in_chair')) as last_visit,
              (select br.name from bookings b2 join barbers br on br.id = b2.barber_id where b2.client_id = c.id and b2.status in ('done','in_chair') group by br.name order by count(*) desc limit 1) as usual
       from clients c left join bookings b on b.client_id = c.id
       where ${where} group by c.id order by c.name limit ${PAGE} offset $5`, [staff.profile.shop_id, term, like, phoneLike, page * PAGE]),
    one<{ n: number }>(`select count(*)::int as n from clients c where ${where}`, [staff.profile.shop_id, term, like, phoneLike]),
  ]);
  const count = total?.n ?? 0;
  const rows = list.map((c) => ({ ...c, last: c.last_visit ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: shop.timezone }).format(new Date(String(c.last_visit))) : "—", usual: c.usual ?? "—" }));
  const cols = { ["--tcols" as string]: "1.5fr 1fr 0.6fr 1fr 1fr" };

  return (
    <>
      <header className="top">
        <div><h1>Clients</h1><small>{count} clients · every booking and walk-in saves here automatically</small></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form style={{ display: "flex", gap: 8 }}>
            <input className="inp" name="q" defaultValue={term} placeholder="Search name, phone or email" aria-label="Search clients" style={{ width: 260 }} />
            <button className="btn btn-ink btn-sm" type="submit">Search</button>
          </form>
          {staff.profile.role === "owner" && <Link className="btn btn-ghost btn-sm" href="/admin/clients/import">Import CSV</Link>}
        </div>
      </header>
      <div className="body">
        <div className="tbl">
          <div className="tr h" style={cols}><span>Client</span><span>Phone</span><span>Visits</span><span>Last visit</span><span>Usual barber</span></div>
          {rows.length === 0 && <p style={{ padding: 18, margin: 0 }}>No clients found.</p>}
          {rows.map((c) => (
            <div className="tr" style={cols} key={c.id}>
              <span><span className="av">{c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span><Link className="rowlink" href={`/admin/clients/${c.id}`}>{c.name}</Link></span>
              <span>{formatPhone(c.phone) || "—"}</span><span>{c.visits}</span><span>{c.last}</span><span>{c.usual}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {page > 0 && <Link className="btn btn-ghost btn-sm" href={`/admin/clients?q=${encodeURIComponent(term)}&page=${page - 1}`}>‹ Previous</Link>}
          {(page + 1) * PAGE < count && <Link className="btn btn-ghost btn-sm" href={`/admin/clients?q=${encodeURIComponent(term)}&page=${page + 1}`}>Next ›</Link>}
        </div>
      </div>
    </>
  );
}
