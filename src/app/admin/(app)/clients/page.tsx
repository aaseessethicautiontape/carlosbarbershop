import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { formatPhone } from "@/lib/format";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Clients" };
const PAGE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const shop = await getShop();
  // Strip characters that have meaning inside a PostgREST filter before using the term.
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim().slice(0, 60);
  const page = Math.max(0, Number.parseInt(sp.page ?? "0", 10) || 0);
  const db = await userClient();

  let query = db
    .from("clients")
    .select("id, name, phone, email, bookings(starts_at, status, barbers(name))", { count: "exact" })
    .order("name")
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q.replace(/\D/g, "") || "x"}%,email.ilike.%${q}%`);
  const { data, count } = await query;

  const rows = (data ?? []).map((c) => {
    const visits = (c.bookings ?? []).filter((b) => b.status === "done" || b.status === "in_chair");
    const last = visits.map((v) => v.starts_at).sort().at(-1);
    const tally = new Map<string, number>();
    for (const v of visits) { const n = (v.barbers as unknown as { name: string } | null)?.name; if (n) tally.set(n, (tally.get(n) ?? 0) + 1); }
    const usual = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { ...c, visits: visits.length, last: last ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: shop.timezone }).format(new Date(last)) : "—", usual };
  });
  const cols = { ["--tcols" as string]: "1.5fr 1fr 0.6fr 1fr 1fr" };

  return (
    <>
      <header className="top">
        <div><h1>Clients</h1><small>{count ?? 0} clients · every booking and walk-in saves here automatically</small></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form style={{ display: "flex", gap: 8 }}>
            <input className="inp" name="q" defaultValue={q} placeholder="Search name, phone or email" aria-label="Search clients" style={{ width: 260 }} />
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
          {page > 0 && <Link className="btn btn-ghost btn-sm" href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page - 1}`}>‹ Previous</Link>}
          {(page + 1) * PAGE < (count ?? 0) && <Link className="btn btn-ghost btn-sm" href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next ›</Link>}
        </div>
      </div>
    </>
  );
}
