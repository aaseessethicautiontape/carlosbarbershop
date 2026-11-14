import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/data/public";
import { queueQuery, seal, ticksQuery } from "@/lib/live";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a SEALED live query (expires in ~60s; the client renews). Only three fixed sources exist:
 *  queue  : walk-in counts (public)        public : "availability changed" ticker (public)
 *  admin  : "something changed" ticker (staff session required)
 * No parameters from the client reach the SQL.
 */
export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("s");
  if (!(await allow(`live:${await clientIp()}`, 60, 120))) return NextResponse.json({ error: "slow_down" }, { status: 429 });

  let sealed;
  if (source === "queue") sealed = await seal(queueQuery((await getShop()).id));
  else if (source === "public") sealed = await seal(ticksQuery("public"));
  else if (source === "admin") {
    if (!(await getStaff())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    sealed = await seal(ticksQuery("admin"));
  } else return NextResponse.json({ error: "bad_request" }, { status: 400 });

  return NextResponse.json(sealed, { headers: { "Cache-Control": "no-store" } });
}
