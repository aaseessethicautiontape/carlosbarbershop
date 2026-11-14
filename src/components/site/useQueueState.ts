"use client";
import { useEffect, useState } from "react";
import { useLive } from "@/components/useLive";
import type { Row } from "@/lib/dbtypes/types";

export type QueueRow = Pick<Row<"queue_state">, "waiting_count" | "on_duty_count" | "free_chairs" | "est_wait_min">;

/**
 * Live walk-in numbers. Starts from the server-rendered snapshot (no layout shift), then follows the sealed
 * Neon Realtime query over `queue_state` (counts only, never names), with a 60s refetch as a safety net.
 * `onChange` lets other islands (the "you're #3" page) re-fetch their own ticket on any change.
 */
export function useQueueState(_shopId: string, initial: QueueRow | null, onChange?: () => void): QueueRow | null {
  const [state, setState] = useState<QueueRow | null>(initial);
  useLive<QueueRow>("queue", (rows) => {
    const r = rows[0];
    if (r) { setState(r); onChange?.(); }
  });
  useEffect(() => {
    const t = setInterval(() => void onChange?.(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
