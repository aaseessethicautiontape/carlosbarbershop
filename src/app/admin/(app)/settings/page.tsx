import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import type { Row } from "@/lib/dbtypes/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const staff = await requireStaff(["owner"]);
  const [shop, hours] = await Promise.all([getShop(), q<Row<"working_hours">>("select * from working_hours where shop_id = $1 and barber_id is null", [staff.profile.shop_id])]);
  return (
    <>
      <header className="top"><div><h1>Settings</h1><small>Shop hours and the booking window</small></div></header>
      <div className="body">
        <SettingsForm initial={{
          bookingWindowDays: shop.booking_window_days, minLeadMinutes: shop.min_lead_minutes, slotStepMinutes: shop.slot_step_minutes, avgWalkinMinutes: shop.avg_walkin_minutes, maxQueue: shop.max_queue, walkinRequiresOpen: shop.walkin_requires_open,
          hours: [0, 1, 2, 3, 4, 5, 6].map((wd) => { const h = hours.find((x) => x.weekday === wd && !x.is_off); return { weekday: wd, closed: !h, opens: h?.opens.slice(0, 5) ?? "09:00", closes: h?.closes.slice(0, 5) ?? "17:00" }; }),
        }} />
      </div>
    </>
  );
}
