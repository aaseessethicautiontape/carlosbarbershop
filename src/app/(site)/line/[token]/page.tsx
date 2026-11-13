import type { Metadata } from "next";
import { InvalidLink } from "@/components/site/InvalidLink";
import { LineStatus } from "@/components/site/LineStatus";
import { getQueueState, getShop } from "@/lib/data/public";
import { adminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your place in line", robots: { index: false } };

export default async function LineTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = verifyToken(token, "walkin");
  if (!t) return <InvalidLink />;
  const [{ data }, shop] = await Promise.all([adminClient().rpc("walkin_status", { p_walkin: t.id }), getShop()]);
  const row = data?.[0];
  if (!row) return <InvalidLink />;
  const q = await getQueueState(shop.id);
  return (
    <section className="section" style={{ paddingTop: 56 }}>
      <div className="wrap" style={{ maxWidth: 620 }}>
        <LineStatus token={token} shopId={shop.id} initial={{ status: row.status, position: row.queue_position, estWaitMin: row.est_wait_min, firstName: row.first_name }}
          initialQueue={q ? { waiting_count: q.waiting_count, on_duty_count: q.on_duty_count, free_chairs: q.free_chairs, est_wait_min: q.est_wait_min } : null} />
      </div>
    </section>
  );
}
