import "server-only";
import { userClient } from "@/lib/supabase/server";
import type { ChairOption, QueueItem } from "@/components/admin/QueueList";

/** Waiting walk-ins (ranked) + which chairs can take someone right now. Runs as the signed-in staff user (RLS). */
export async function loadQueue(): Promise<{ items: QueueItem[]; chairs: ChairOption[] }> {
  const db = await userClient();
  const nowIso = new Date().toISOString();
  const [{ data: waiting }, { data: barbers }, { data: busy }, { data: services }] = await Promise.all([
    db.from("walkins_ranked").select("id, display_name, phone, joined_at, position, service_id").order("position"),
    db.from("barbers").select("id, name, on_duty").eq("on_duty", true).order("sort_order"),
    db.from("bookings").select("barber_id").in("status", ["booked", "in_chair"]).lte("starts_at", nowIso).gt("ends_at", nowIso),
    db.from("services").select("id, name"),
  ]);
  const svc = new Map((services ?? []).map((s) => [s.id, s.name]));
  const busyIds = new Set((busy ?? []).map((b) => b.barber_id));
  return {
    items: (waiting ?? []).map((w) => ({
      id: w.id!,
      position: w.position!,
      name: w.display_name!,
      service: w.service_id ? (svc.get(w.service_id) ?? "Haircut") : "Not sure yet",
      waitingMin: Math.max(0, Math.round((Date.now() - new Date(w.joined_at!).getTime()) / 60000)),
      hasPhone: !!w.phone,
    })),
    chairs: (barbers ?? []).map((b) => ({ id: b.id, name: b.name, free: !busyIds.has(b.id) })).sort((a, b) => Number(b.free) - Number(a.free)),
  };
}
