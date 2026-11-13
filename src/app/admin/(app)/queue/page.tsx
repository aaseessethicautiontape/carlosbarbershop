import { QueueList } from "@/components/admin/QueueList";
import { requireStaff } from "@/lib/auth/session";
import { loadQueue } from "@/lib/admin/queue";

export const metadata = { title: "Walk-in line" };

export default async function QueuePage() {
  await requireStaff();
  const { items, chairs } = await loadQueue();
  return (
    <>
      <header className="top"><div><h1>Walk-in line</h1><small>Live across every screen</small></div></header>
      <div className="body">
        <div className="panel" style={{ width: "100%", maxWidth: 560, padding: "6px 0 0" }}><QueueList items={items} chairs={chairs} /></div>
      </div>
    </>
  );
}
