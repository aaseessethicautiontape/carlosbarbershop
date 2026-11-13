import "server-only";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { notify } from "@/lib/notify";
import { adminClient } from "@/lib/supabase/admin";

const HOUR = 3_600_000;

/**
 * Sends due appointment reminders. Safe to run as often as you like: each booking is stamped once.
 *  - 24h: appointment starts within the next 24h (and at least 1h away), and was booked 25h+ ahead
 *  - 2h:  starts within the next 2h (and at least 15 min away), and was booked 3h+ ahead
 * "Booked ahead" guards stop a booking made at noon for 3pm from getting a "see you tomorrow" text.
 */
export async function runReminders(now = new Date()): Promise<{ r24: number; r2: number }> {
  const db = adminClient();
  const out = { r24: 0, r2: 0 };

  const jobs = [
    { key: "reminder_24h" as const, col: "reminder_24h_sent_at" as const, from: now.getTime() + HOUR, to: now.getTime() + 24 * HOUR, minLead: 25 * HOUR, bump: "r24" as const },
    { key: "reminder_2h" as const, col: "reminder_2h_sent_at" as const, from: now.getTime() + 0.25 * HOUR, to: now.getTime() + 2 * HOUR, minLead: 3 * HOUR, bump: "r2" as const },
  ];

  for (const job of jobs) {
    const { data } = await db.from("bookings").select("id, shop_id, starts_at, created_at").eq("status", "booked").is(job.col, null)
      .gte("starts_at", new Date(job.from).toISOString()).lte("starts_at", new Date(job.to).toISOString());
    for (const b of data ?? []) {
      if (new Date(b.starts_at).getTime() - new Date(b.created_at).getTime() < job.minLead) continue;
      // Claim first (atomic), so two overlapping runs never double-send.
      const { data: claimed } = await db.from("bookings").update(job.col === "reminder_24h_sent_at" ? { reminder_24h_sent_at: now.toISOString() } : { reminder_2h_sent_at: now.toISOString() }).eq("id", b.id).is(job.col, null).select("id");
      if (!claimed?.length) continue;
      const view = await getBookingView(b.id);
      if (!view) continue;
      const res = await notify({ shopId: b.shop_id, template: job.key, to: { email: view.clientEmail, phone: view.clientPhone }, data: messageDataFor(view), bookingId: b.id });
      if (res.length) out[job.bump]++;
    }
  }
  return out;
}
