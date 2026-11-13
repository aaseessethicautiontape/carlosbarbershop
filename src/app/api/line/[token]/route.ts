import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { allow, clientIp } from "@/lib/ratelimit";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Your own place in line. The signed token is the only credential; returns first name + numbers, nothing about anyone else. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const t = verifyToken((await params).token, "walkin");
  if (!t) return NextResponse.json({ error: "invalid" }, { status: 404 });
  if (!(await allow(`linestatus:${await clientIp()}`, 60, 120))) return NextResponse.json({ error: "slow_down" }, { status: 429 });
  const { data } = await adminClient().rpc("walkin_status", { p_walkin: t.id });
  const row = data?.[0];
  if (!row) return NextResponse.json({ error: "invalid" }, { status: 404 });
  return NextResponse.json({ status: row.status, position: row.queue_position, estWaitMin: row.est_wait_min, firstName: row.first_name }, { headers: { "Cache-Control": "no-store" } });
}
