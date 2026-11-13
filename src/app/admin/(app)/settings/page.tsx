import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { userClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireStaff(["owner"]);
  const db = await userClient();
  const [shop, { data: hours }] = await Promise.all([getShop(), db.from("working_hours").select("*").is("barber_id", null)]);
  return (
    <>
      <header className="top"><div><h1>Settings</h1><small>Shop hours and the booking window</small></div></header>
      <div className="body">
        <SettingsForm initial={{
          bookingWindowDays: shop.booking_window_days, minLeadMinutes: shop.min_lead_minutes, slotStepMinutes: shop.slot_step_minutes, avgWalkinMinutes: shop.avg_walkin_minutes, maxQueue: shop.max_queue, walkinRequiresOpen: shop.walkin_requires_open,
          hours: [0, 1, 2, 3, 4, 5, 6].map((wd) => { const h = (hours ?? []).find((x) => x.weekday === wd && !x.is_off); return { weekday: wd, closed: !h, opens: h?.opens.slice(0, 5) ?? "09:00", closes: h?.closes.slice(0, 5) ?? "17:00" }; }),
        }} />
      </div>
    </>
  );
}
