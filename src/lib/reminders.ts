import "server-only";
import { getBookingView, messageDataFor } from "@/lib/booking/view";
import { q } from "@/lib/db";
import { notify } from "@/lib/notify";

const HOUR = 3_600_000;

/**
 * Sends due appointment reminders. Safe to run as often as you like: each booking is stamped once.
 *  - 24h: appointment starts within the next 24h (and at least 1h away), and was booked 25h+ ahead
 *  - 2h:  starts within the next 2h (and at least 15 min away), and was booked 3h+ ahead
 * "Booked ahead" guards stop a booking made at noon for 3pm from getting a "see you tomorrow" text.
 */
export async function runReminders(now = new Date()): Promise<{ r24: number; r2: number }> {
  const out = { r24: 0, r2: 0 };
  const jobs = [
    { key: "reminder_24h" as const, col: "reminder_24h_sent_at", from: now.getTime() + HOUR, to: now.getTime() + 24 * HOUR, minLead: 25 * HOUR, bump: "r24" as const },
    { key: "reminder_2h" as const, col: "reminder_2h_sent_at", from: now.getTime() + 0.25 * HOUR, to: now.getTime() + 2 * HOUR, minLead: 3 * HOUR, bump: "r2" as const },
  ];

  for (const job of jobs) {
    // job.col comes from the fixed list above, never from user input.
    const due = await q<{ id: string; shop_id: string; starts_at: unknown; created_at: unknown }>(
      `select id, shop_id, starts_at, created_at from bookings where status = 'booked' and ${job.col} is null and starts_at >= $1 and starts_at <= $2`,
      [new Date(job.from).toISOString(), new Date(job.to).toISOString()],
    );
    for (const b of due) {
      if (new Date(String(b.starts_at)).getTime() - new Date(String(b.created_at)).getTime() < job.minLead) continue;
      // Claim first (atomic), so two overlapping runs never double-send.
      const claimed = await q<{ id: string }>(`update bookings set ${job.col} = $2 where id = $1 and ${job.col} is null returning id`, [b.id, now.toISOString()]);
      if (!claimed.length) continue;
      const view = await getBookingView(b.id);
      if (!view) continue;
      const res = await notify({ shopId: b.shop_id, template: job.key, to: { email: view.clientEmail, phone: view.clientPhone }, data: messageDataFor(view), bookingId: b.id });
      if (res.length) out[job.bump]++;
    }
  }
  return out;
}
