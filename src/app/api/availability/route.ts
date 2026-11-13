import { NextResponse, type NextRequest } from "next/server";
import { loadSlots } from "@/lib/availability/load";
import { isDay } from "@/lib/availability/tz";
import { allow, clientIp } from "@/lib/ratelimit";
import { availabilityQuery } from "@/lib/schemas/booking";

export const dynamic = "force-dynamic";

/** Public, read-only: free start times for one day. Built from public-safe data only. */
export async function GET(req: NextRequest) {
  const parsed = availabilityQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success || !isDay(parsed.data.day)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const ip = await clientIp();
  if (!(await allow(`availability:${ip}`, 60, 90))) return NextResponse.json({ error: "slow_down" }, { status: 429 });

  const { slots, error } = await loadSlots({ serviceId: parsed.data.service, barberId: parsed.data.barber, day: parsed.data.day });
  if (error) return NextResponse.json({ error }, { status: 404 });
  return NextResponse.json({ day: parsed.data.day, slots: slots.map((s) => s.start) }, { headers: { "Cache-Control": "no-store" } });
}
