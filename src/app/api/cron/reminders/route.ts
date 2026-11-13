import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Vercel Cron target (see vercel.json). Requires `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = serverEnv().CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runReminders());
}
