import { notFound } from "next/navigation";
import { RunRemindersButton } from "@/components/admin/RunRemindersButton";
import { requireStaff } from "@/lib/auth/session";
import { isMock } from "@/lib/env";
import { q } from "@/lib/db";

export const metadata = { title: "Outbox" };

/** MOCK MODE dev log: every email and text the app WOULD have sent. */
export default async function OutboxPage() {
  if (!isMock()) notFound();
  const staff = await requireStaff();
  const data = await q<{ id: string; channel: string; template_key: string; status: string; to_address: string; created_at: unknown; subject: string | null; body: string; error: string | null }>("select id, channel, template_key, status, to_address, created_at, subject, body, error from notifications_log where shop_id = $1 order by created_at desc limit 100", [staff.profile.shop_id]);
  return (
    <>
      <header className="top"><div><h1>Outbox</h1><small>Mock mode: nothing leaves this machine. Live mode sends through Resend.</small></div>{staff.profile.role === "owner" && <RunRemindersButton />}</header>
      <div className="body">
        {data.length === 0 && <p className="card-a">Nothing yet. Make a booking or join the walk-in line on the public site and it will appear here.</p>}
        {data.map((m) => (
          <article className="card-a" key={m.id}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <span className="chip">{m.channel}</span><span className="pill">{m.template_key}</span><span className="pill">{m.status}</span>
              <span style={{ color: "var(--a-mute)", fontSize: 12 }}>to {m.to_address} · {new Date(String(m.created_at)).toLocaleString("en-CA")}</span>
            </div>
            {m.subject && <b style={{ display: "block", marginBottom: 6 }}>{m.subject}</b>}
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", font: "400 13px/1.5 var(--font-body)", color: "#4b4035" }}>{m.body}</pre>
            {m.error && <p className="form-error" style={{ marginTop: 8 }}>{m.error}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
