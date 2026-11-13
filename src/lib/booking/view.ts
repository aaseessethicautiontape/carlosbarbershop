import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { getShop } from "@/lib/data/public";
import { formatPrice, formatWhen } from "@/lib/format";
import { addressOneLine, site } from "@/content/site";
import { signToken } from "@/lib/tokens";
import { siteUrl } from "@/lib/notify";
import type { MessageData } from "@/lib/notify/templates";
import type { BookingStatus } from "@/lib/supabase/types";

export interface BookingView {
  id: string; shopId: string; status: BookingStatus; startsAt: string; endsAt: string; whenLabel: string;
  serviceId: string; serviceName: string; barberId: string; barberName: string; priceLabel: string;
  clientName: string; clientFirst: string; clientEmail: string | null; clientPhone: string | null; tz: string; canChange: boolean;
}

/** Server-side lookup for token holders. Uses the service role, returns only what the holder needs. */
export async function getBookingView(id: string): Promise<BookingView | null> {
  const { data } = await adminClient()
    .from("bookings")
    .select("id, shop_id, status, starts_at, ends_at, service_id, barber_id, price_cents_snapshot, services(name), barbers(name), clients(name, email, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const shop = await getShop();
  const client = data.clients as unknown as { name: string; email: string | null; phone: string | null } | null;
  return {
    id: data.id, shopId: data.shop_id, status: data.status, startsAt: data.starts_at, endsAt: data.ends_at,
    whenLabel: formatWhen(data.starts_at, shop.timezone), serviceId: data.service_id, barberId: data.barber_id,
    serviceName: (data.services as unknown as { name: string }).name, barberName: (data.barbers as unknown as { name: string }).name,
    priceLabel: formatPrice(data.price_cents_snapshot), clientName: client?.name ?? "", clientFirst: (client?.name ?? "").split(" ")[0] ?? "",
    clientEmail: client?.email ?? null, clientPhone: client?.phone ?? null, tz: shop.timezone,
    canChange: data.status === "booked" && new Date(data.starts_at).getTime() > Date.now(),
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
