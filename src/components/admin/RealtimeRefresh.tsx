"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useLive } from "@/components/useLive";

/**
 * Cross-device live updates for staff. Follows the sealed "admin" ticker (a counter bumped by database triggers on
 * bookings, walk-ins and barbers) and re-renders this screen's server data when it changes. Seat a walk-in on the
 * shop iPad and it disappears from every other open admin screen. The ticker holds no personal data.
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useLive<{ n: string }>("admin", (rows) => {
    const n = rows[0]?.n;
    if (n === undefined) return;
    if (last.current !== null && last.current !== n) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 150);
    }
    last.current = n;
  });
  return null;
}
