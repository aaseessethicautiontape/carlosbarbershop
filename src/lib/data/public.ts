import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/server";
import type { Row } from "@/lib/supabase/types";

/**
 * Public reads. They use the anon, cookie-free client, so RLS is what protects us, and the pages that
 * call them stay static (ISR). Admin edits call revalidateTag() with the tags below.
 */
export type Shop = Row<"shops">;
export type Barber = Row<"barbers">;
export type Service = Row<"services">;
export type Hours = Row<"working_hours">;
export type QueueState = Row<"queue_state">;

const TTL = 3600;

export const getShop = unstable_cache(
  async (): Promise<Shop> => {
    const { data, error } = await publicClient().from("shops").select("*").limit(1).single();
    if (error || !data) throw new Error(`Could not load the shop: ${error?.message}. Is local Supabase running (pnpm db:start)?`);
    return data;
  },
  ["shop"],
  { tags: ["shop"], revalidate: TTL },
);

export const getServices = unstable_cache(
  async (): Promise<Service[]> => {
    const { data, error } = await publicClient().from("services").select("*").eq("show_online", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["services"],
  { tags: ["services"], revalidate: TTL },
);

export const getBarbers = unstable_cache(
  async (): Promise<Barber[]> => {
    const { data, error } = await publicClient().from("barbers").select("*").eq("is_published", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["barbers"],
  { tags: ["barbers"], revalidate: 300 },
);

export const getBarberServices = unstable_cache(
  async (): Promise<Array<{ barber_id: string; service_id: string }>> => {
    const { data, error } = await publicClient().from("barber_services").select("barber_id, service_id");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["barber_services"],
  { tags: ["barbers", "services"], revalidate: TTL },
);

export const getHours = unstable_cache(
  async (): Promise<Hours[]> => {
    const { data, error } = await publicClient().from("working_hours").select("*");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["hours"],
  { tags: ["hours"], revalidate: TTL },
);

/** Not cached: live numbers (the client island also subscribes via Realtime). */
export async function getQueueState(shopId: string): Promise<QueueState | null> {
  const { data } = await publicClient().from("queue_state").select("*").eq("shop_id", shopId).maybeSingle();
  return data;
}

export const shopHours = (hours: Hours[]) => hours.filter((h) => h.barber_id === null);
