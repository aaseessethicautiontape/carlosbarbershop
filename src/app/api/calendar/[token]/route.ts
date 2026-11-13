import { NextResponse } from "next/server";
import { getBookingView } from "@/lib/booking/view";
import { addressOneLine, site } from "@/content/site";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** .ics for "Add to calendar". The signed token is the only way in. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const t = verifyToken((await params).token, "booking");
  const b = t ? await getBookingView(t.id) : null;
  if (!b) return new NextResponse("Not found", { status: 404 });
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Carlo's Barbershop//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${b.id}@carlosbarbershop`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(b.startsAt)}`, `DTEND:${stamp(b.endsAt)}`,
    `SUMMARY:${esc(`${b.serviceName} with ${b.barberName}`)}`, `LOCATION:${esc(`${site.name}, ${addressOneLine}`)}`,
    `DESCRIPTION:${esc(`Pay at the shop. Questions? ${site.phoneDisplay}`)}`, "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Haircut in 2 hours", "END:VALARM", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="carlos-booking.ics"', "Cache-Control": "no-store" } });
}
