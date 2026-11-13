import Image from "next/image";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { RealtimeRefresh } from "@/components/admin/RealtimeRefresh";
import { signOutAction } from "@/app/admin/login/actions";
import { requireStaff } from "@/lib/auth/session";
import { isMock } from "@/lib/env";
import { userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const db = await userClient();
  const { count } = await db.from("walkins").select("id", { count: "exact", head: true }).eq("status", "waiting");
  const owner = staff.profile.role === "owner";
  return (
    <div className="ad">
      <RealtimeRefresh tables={["walkins", "bookings", "barbers"]} />
      <aside className="side">
        <Link href="/admin" className="brand"><Image src="/brand/carlos-logo-web.png" alt="" width={46} height={45} /><div><b>Carlo&apos;s</b><small>Shop admin</small></div></Link>
        <AdminNav owner={owner} mock={isMock()} queueCount={count ?? 0} />
        <div className="who">
          <span className="av-lg">{staff.profile.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <div><b>{staff.profile.display_name}</b><br /><small>{owner ? "Owner" : "Barber"}</small></div>
          <form action={signOutAction} style={{ marginLeft: "auto" }}><button className="link-btn" type="submit">Sign out</button></form>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
