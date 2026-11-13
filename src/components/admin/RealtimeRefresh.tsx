"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Cross-device live updates for staff. Subscribes (as the signed-in staff user, so RLS applies) to
 * the given tables; any insert/update/delete re-renders the server data on this screen.
 * Seat a walk-in on the shop iPad and it disappears from every other open admin screen.
 */
export function RealtimeRefresh({ tables }: { tables: Array<"walkins" | "bookings" | "barbers" | "queue_state"> }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const db = browserClient();
    const bump = () => { clearTimeout(timer.current); timer.current = setTimeout(() => router.refresh(), 150); };
    const ch = tables.reduce((c, table) => c.on("postgres_changes", { event: "*", schema: "public", table }, bump), db.channel(`admin:${Math.random().toString(36).slice(2)}`));
    ch.subscribe();
    return () => { clearTimeout(timer.current); void db.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  return null;
}
