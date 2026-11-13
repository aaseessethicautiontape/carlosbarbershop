import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClientEditForm } from "@/components/admin/ClientEditForm";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { formatPhone, formatPrice, formatWhen } from "@/lib/format";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Client" };
const STATUS: Record<string, string> = { booked: "Booked", in_chair: "In the chair", done: "Done", no_show: "No-show", cancelled: "Cancelled" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const shop = await getShop();
  const db = await userClient();
  const [{ data: client }, { data: visits }] = await Promise.all([
    db.from("clients").select("*").eq("id", id).maybeSingle(),
    db.from("bookings").select("id, starts_at, status, price_cents_snapshot, services(name), barbers(name)").eq("client_id", id).order("starts_at", { ascending: false }).limit(100),
  ]);
  if (!client) notFound();
  const cols = { ["--tcols" as string]: "1.4fr 1.2fr 1fr 0.8fr 0.7fr" };
  const done = (visits ?? []).filter((v) => v.status === "done").length;

  return (
    <>
      <header className="top">
        <div><h1>{client.name}</h1><small>{formatPhone(client.phone) || "No phone"} · {done} completed visits · client since {new Date(client.created_at).getFullYear()}</small></div>
        <Link className="btn btn-ghost btn-sm" href="/admin/clients">‹ All clients</Link>
      </header>
      <div className="body">
        <ClientEditForm client={{ id: client.id, name: client.name, email: client.email ?? "", phone: client.phone ?? "", notes: client.notes ?? "" }} />
        <div className="tbl">
          <div className="tr h" style={cols}><span>When</span><span>Service</span><span>Barber</span><span>Status</span><span>Price</span></div>
          {(visits ?? []).length === 0 && <p style={{ padding: 18, margin: 0 }}>No visits yet.</p>}
          {(visits ?? []).map((v) => (
            <div className="tr" style={cols} key={v.id}>
              <span>{formatWhen(v.starts_at, shop.timezone)}</span>
              <span>{(v.services as unknown as { name: string } | null)?.name}</span>
              <span>{(v.barbers as unknown as { name: string } | null)?.name}</span>
              <span className="pill">{STATUS[v.status] ?? v.status}</span>
              <span>{formatPrice(v.price_cents_snapshot)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
