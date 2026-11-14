import "server-only";
import { iso, one } from "@/lib/db";
import { getShop } from "@/lib/data/public";
import { formatPrice, formatWhen } from "@/lib/format";
import { addressOneLine, site } from "@/content/site";
import { signToken } from "@/lib/tokens";
import { siteUrl } from "@/lib/notify";
import type { MessageData } from "@/lib/notify/templates";
import type { BookingStatus } from "@/lib/dbtypes/types";

export interface BookingView {
  id: string; shopId: string; status: BookingStatus; startsAt: string; endsAt: string; whenLabel: string;
  serviceId: string; serviceName: string; barberId: string; barberName: string; priceLabel: string;
  clientName: string; clientFirst: string; clientEmail: string | null; clientPhone: string | null; tz: string; canChange: boolean;
}

interface Row {
  id: string; shop_id: string; status: BookingStatus; starts_at: unknown; ends_at: unknown; service_id: string; barber_id: string;
  price_cents_snapshot: number | null; service_name: string; barber_name: string; client_name: string; client_email: string | null; client_phone: string | null;
}

/** Server-side lookup for token holders. Returns only what the holder needs. */
export async function getBookingView(id: string): Promise<BookingView | null> {
  const r = await one<Row>(
    `select b.id, b.shop_id, b.status, b.starts_at, b.ends_at, b.service_id, b.barber_id, b.price_cents_snapshot,
            s.name as service_name, br.name as barber_name, c.name as client_name, c.email as client_email, c.phone as client_phone
     from bookings b join services s on s.id = b.service_id join barbers br on br.id = b.barber_id join clients c on c.id = b.client_id
     where b.id = $1`,
    [id],
  );
  if (!r) return null;
  const shop = await getShop();
  const startsAt = iso(r.starts_at);
  return {
    id: r.id, shopId: r.shop_id, status: r.status, startsAt, endsAt: iso(r.ends_at), whenLabel: formatWhen(startsAt, shop.timezone),
    serviceId: r.service_id, barberId: r.barber_id, serviceName: r.service_name, barberName: r.barber_name, priceLabel: formatPrice(r.price_cents_snapshot),
    clientName: r.client_name, clientFirst: r.client_name.split(" ")[0] ?? "", clientEmail: r.client_email, clientPhone: r.client_phone, tz: shop.timezone,
    canChange: r.status === "booked" && new Date(startsAt).getTime() > Date.now(),
  };
}

export function messageDataFor(b: BookingView): MessageData {
  const token = signToken("booking", b.id);
  const base = siteUrl();
  return {
    shopName: site.name, firstName: b.clientFirst || "there", address: addressOneLine, phone: site.phoneDisplay,
    logoUrl: `${base}/brand/carlos-logo-web.png`, bookUrl: `${base}/book`, directionsUrl: site.googleMapsDirections,
    serviceName: b.serviceName, barberName: b.barberName, whenLabel: b.whenLabel, priceLabel: b.priceLabel,
    manageUrl: `${base}/b/${token}`, calendarUrl: `${base}/api/calendar/${token}`,
  };
}
