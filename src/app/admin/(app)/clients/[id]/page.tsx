import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClientEditForm } from "@/components/admin/ClientEditForm";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { formatPhone, formatPrice, formatWhen } from "@/lib/format";
import { one, q } from "@/lib/db";

export const metadata = { title: "Client" };
const STATUS: Record<string, string> = { booked: "Booked", in_chair: "In the chair", done: "Done", no_show: "No-show", cancelled: "Cancelled" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const shop = await getShop();
  const [client, visits] = await Promise.all([
    one<{ id: string; name: string; phone: string | null; email: string | null; notes: string | null; created_at: unknown }>("select id, name, phone, email, notes, created_at from clients where id = $1 and shop_id = $2", [id, staff.profile.shop_id]),
    q<{ id: string; starts_at: unknown; status: string; price_cents_snapshot: number | null; service_name: string | null; barber_name: string | null }>(
      "select b.id, b.starts_at, b.status, b.price_cents_snapshot, s.name as service_name, br.name as barber_name from bookings b left join services s on s.id = b.service_id left join barbers br on br.id = b.barber_id where b.client_id = $1 order by b.starts_at desc limit 100", [id]),
  ]);
  if (!client) notFound();
  const cols = { ["--tcols" as string]: "1.4fr 1.2fr 1fr 0.8fr 0.7fr" };
  const done = visits.filter((v) => v.status === "done").length;

  return (
    <>
      <header className="top">
        <div><h1>{client.name}</h1><small>{formatPhone(client.phone) || "No phone"} · {done} completed visits · client since {new Date(String(client.created_at)).getFullYear()}</small></div>
        <Link className="btn btn-ghost btn-sm" href="/admin/clients">‹ All clients</Link>
      </header>
      <div className="body">
        <ClientEditForm client={{ id: client.id, name: client.name, email: client.email ?? "", phone: client.phone ?? "", notes: client.notes ?? "" }} />
        <div className="tbl">
          <div className="tr h" style={cols}><span>When</span><span>Service</span><span>Barber</span><span>Status</span><span>Price</span></div>
          {visits.length === 0 && <p style={{ padding: 18, margin: 0 }}>No visits yet.</p>}
          {visits.map((v) => (
            <div className="tr" style={cols} key={v.id}>
              <span>{formatWhen(new Date(String(v.starts_at)).toISOString(), shop.timezone)}</span>
              <span>{v.service_name}</span>
              <span>{v.barber_name}</span>
              <span className="pill">{STATUS[v.status] ?? v.status}</span>
              <span>{formatPrice(v.price_cents_snapshot)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
