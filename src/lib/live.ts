import "server-only";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { serverEnv } from "@/lib/env.server";

/**
 * Neon Realtime (live SQL). Queries are sealed on the SERVER (so the browser can't read or change them)
 * and the browser subscribes to the sealed capability. We only ever seal queries over tables that hold
 * no personal data: queue_state (counts) and live_ticks (a change counter).
 */
let rt: ReturnType<typeof createRealtime> | undefined;
const realtime = () => {
  const env = serverEnv();
  rt ??= createRealtime({ secret: env.NEON_REALTIME_SECRET, db: env.NEON_REALTIME_DB });
  return rt;
};

export const queueQuery = (shopId: string) =>
  rawSql<{ waiting_count: number; on_duty_count: number; free_chairs: number; est_wait_min: number | null }>(
    "SELECT waiting_count, on_duty_count, free_chairs, est_wait_min FROM queue_state WHERE shop_id = $1::uuid", [shopId]);

export const ticksQuery = (scope: "public" | "admin") =>
  rawSql<{ n: string }>("SELECT n FROM live_ticks WHERE scope = $1::text", [scope]);

export const seal = (query: ReturnType<typeof queueQuery> | ReturnType<typeof ticksQuery>) => realtime().seal({ query: query as never });
