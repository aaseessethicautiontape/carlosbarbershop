"use client";
import { useEffect, useId, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import type { Row } from "@/lib/supabase/types";

export type QueueRow = Pick<Row<"queue_state">, "waiting_count" | "on_duty_count" | "free_chairs" | "est_wait_min">;

/**
 * Live walk-in numbers. Starts from the server-rendered snapshot (no layout shift), then follows
 * Supabase Realtime on `queue_state` (public, no personal data) with a 60s refetch as a safety net.
 * `onChange` lets other islands (the "you're #3" page) re-fetch their own ticket on any change.
 */
export function useQueueState(shopId: string, initial: QueueRow | null, onChange?: () => void): QueueRow | null {
  const [state, setState] = useState<QueueRow | null>(initial);
  const uid = useId(); // several islands can mount at once; each needs its own channel
  useEffect(() => {
    const db = browserClient();
    const pull = async () => {
      const { data } = await db.from("queue_state").select("waiting_count,on_duty_count,free_chairs,est_wait_min").eq("shop_id", shopId).maybeSingle();
      if (data) setState(data);
    };
    pull();
    const ch = db
      .channel(`queue:${shopId}:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_state", filter: `shop_id=eq.${shopId}` }, (payload) => {
        const r = payload.new as Partial<QueueRow>;
        if (r && typeof r.waiting_count === "number") setState({ waiting_count: r.waiting_count, on_duty_count: r.on_duty_count ?? 0, free_chairs: r.free_chairs ?? 0, est_wait_min: r.est_wait_min ?? null });
        onChange?.();
      })
      .subscribe();
    const timer = setInterval(pull, 60_000);
    return () => { clearInterval(timer); void db.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);
  return state;
}
