import "server-only";
import { q } from "@/lib/db";
import type { ChairOption, QueueItem } from "@/components/admin/QueueList";

/** Waiting walk-ins (ranked) + which chairs can take someone right now. Call only after requireStaff(). */
export async function loadQueue(shopId: string): Promise<{ items: QueueItem[]; chairs: ChairOption[] }> {
  const [waiting, barbers, busy, services] = await Promise.all([
    q<{ id: string; display_name: string; phone: string | null; joined_at: unknown; position: number; service_id: string | null }>("select id, display_name, phone, joined_at, position, service_id from walkins_ranked where shop_id = $1 order by position", [shopId]),
    q<{ id: string; name: string }>("select id, name from barbers where shop_id = $1 and on_duty order by sort_order", [shopId]),
    q<{ barber_id: string }>("select barber_id from bookings where shop_id = $1 and status in ('booked','in_chair') and starts_at <= now() and ends_at > now()", [shopId]),
    q<{ id: string; name: string }>("select id, name from services where shop_id = $1", [shopId]),
  ]);
  const svc = new Map(services.map((s) => [s.id, s.name]));
  const busyIds = new Set(busy.map((b) => b.barber_id));
  return {
    items: waiting.map((w) => ({
      id: w.id, position: w.position, name: w.display_name, service: w.service_id ? (svc.get(w.service_id) ?? "Haircut") : "Not sure yet",
      waitingMin: Math.max(0, Math.round((Date.now() - new Date(String(w.joined_at)).getTime()) / 60000)), hasPhone: !!w.phone,
    })),
    chairs: barbers.map((b) => ({ id: b.id, name: b.name, free: !busyIds.has(b.id) })).sort((a, b) => Number(b.free) - Number(a.free)),
  };
}
