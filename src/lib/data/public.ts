import { unstable_cache } from "next/cache";
import { q } from "@/lib/db";
import type { Row } from "@/lib/dbtypes/types";

/**
 * Public reads for the static/ISR pages. Server-only (they run during render), cached with tags;
 * admin edits call revalidateTag() with the tags below. Only public-safe tables are touched here.
 */
export type Shop = Row<"shops">;
export type Barber = Row<"barbers">;
export type Service = Row<"services">;
export type Hours = Row<"working_hours">;
export type QueueState = Row<"queue_state">;

const TTL = 3600;

export const getShop = unstable_cache(
  async (): Promise<Shop> => {
    const rows = await q<Shop>("select * from shops limit 1");
    if (!rows[0]) throw new Error("No shop found. Run the migrations and db/seed.sql (see README).");
    return rows[0];
  },
  ["shop"],
  { tags: ["shop"], revalidate: TTL },
);

export const getServices = unstable_cache(
  async (): Promise<Service[]> => q<Service>("select * from services where show_online order by sort_order"),
  ["services"],
  { tags: ["services"], revalidate: TTL },
);

export const getBarbers = unstable_cache(
  async (): Promise<Barber[]> => q<Barber>("select * from barbers where is_published order by sort_order"),
  ["barbers"],
  { tags: ["barbers"], revalidate: 300 },
);

export const getBarberServices = unstable_cache(
  async (): Promise<Array<{ barber_id: string; service_id: string }>> => q("select barber_id, service_id from barber_services"),
  ["barber_services"],
  { tags: ["barbers", "services"], revalidate: TTL },
);

export const getHours = unstable_cache(
  async (): Promise<Hours[]> => q<Hours>("select * from working_hours"),
  ["hours"],
  { tags: ["hours"], revalidate: TTL },
);

/** Not cached: live numbers (the client island also follows Realtime). */
export async function getQueueState(shopId: string): Promise<QueueState | null> {
  return (await q<QueueState>("select * from queue_state where shop_id = $1", [shopId]))[0] ?? null;
}

export const shopHours = (hours: Hours[]) => hours.filter((h) => h.barber_id === null);
