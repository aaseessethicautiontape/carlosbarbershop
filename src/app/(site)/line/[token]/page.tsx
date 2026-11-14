import type { Metadata } from "next";
import { InvalidLink } from "@/components/site/InvalidLink";
import { LineStatus } from "@/components/site/LineStatus";
import { getQueueState, getShop } from "@/lib/data/public";
import { q } from "@/lib/db";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your place in line", robots: { index: false } };

export default async function LineTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = verifyToken(token, "walkin");
  if (!t) return <InvalidLink />;
  const [rows, shop] = await Promise.all([
    q<{ status: "waiting" | "seated" | "removed" | "left"; queue_position: number | null; est_wait_min: number | null; first_name: string }>("select * from public.walkin_status($1::uuid)", [t.id]),
    getShop(),
  ]);
  const row = rows[0];
  if (!row) return <InvalidLink />;
  const queue = await getQueueState(shop.id);
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="wrap" style={{ maxWidth: 620 }}>
        <LineStatus token={token} shopId={shop.id} initial={{ status: row.status, position: row.queue_position, estWaitMin: row.est_wait_min, firstName: row.first_name }}
          initialQueue={queue ? { waiting_count: queue.waiting_count, on_duty_count: queue.on_duty_count, free_chairs: queue.free_chairs, est_wait_min: queue.est_wait_min } : null} />
      </div>
    </section>
  );
}
