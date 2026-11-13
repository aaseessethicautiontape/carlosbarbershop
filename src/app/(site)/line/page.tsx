import type { Metadata } from "next";
import { JoinLineForm } from "@/components/site/JoinLineForm";
import { LiveWaitCard } from "@/components/site/LiveWaitCard";
import { getHours, getQueueState, getServices, getShop, shopHours } from "@/lib/data/public";

export const revalidate = 30;
export const metadata: Metadata = { title: "Join the walk-in line", description: "See the live wait at Carlo's and join the line from your phone." };

export default async function LinePage() {
  const [shop, hours, services] = await Promise.all([getShop(), getHours(), getServices()]);
  const q = await getQueueState(shop.id);
  const initial = q ? { waiting_count: q.waiting_count, on_duty_count: q.on_duty_count, free_chairs: q.free_chairs, est_wait_min: q.est_wait_min } : null;
  return (
    <>
      <section className="page-head dark"><div className="wrap"><p className="kick">Walk-ins</p><h1 className="h2">No more <em>guessing the wait.</em></h1></div></section>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="wrap">
          <div className="ways" style={{ marginTop: 0, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <LiveWaitCard variant="card" shopId={shop.id} tz={shop.timezone} hours={shopHours(hours)} initial={initial} />
            <JoinLineForm services={services.map((s) => ({ id: s.id, name: s.name }))} />
          </div>
        </div>
      </section>
    </>
  );
}
