import { ServicesEditor } from "@/components/admin/ServicesEditor";
import { requireStaff } from "@/lib/auth/session";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Services & prices" };

export default async function ServicesAdminPage() {
  await requireStaff(["owner"]);
  const db = await userClient();
  const { data } = await db.from("services").select("*").order("sort_order").order("name");
  return (
    <>
      <header className="top"><div><h1>Services &amp; prices</h1><small>Change a price here and it updates on the website right away. Leave a price empty to show [PRICE].</small></div></header>
      <div className="body">
        <ServicesEditor services={(data ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price_cents === null ? "" : String(s.price_cents / 100), durationMinutes: s.duration_minutes, durationLabel: s.duration_label ?? "", showOnline: s.show_online }))} />
      </div>
    </>
  );
}
