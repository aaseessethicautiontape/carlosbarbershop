import "server-only";
import { addressOneLine, site } from "@/content/site";
import { notify, siteUrl } from "@/lib/notify";
import { adminClient } from "@/lib/supabase/admin";
import { signToken } from "@/lib/tokens";

/**
 * "You're up next" text. Called after anything that moves the line (join, seat, remove, duty toggle).
 * Texts the person at position 1 once (notified_next_at guards against repeats), only when a chair is free.
 */
export async function notifyNextInLine(shopId: string): Promise<void> {
  try {
    const db = adminClient();
    const { data: q } = await db.from("queue_state").select("free_chairs").eq("shop_id", shopId).maybeSingle();
    if (!q || q.free_chairs < 1) return;
    const { data: first } = await db.from("walkins").select("id, display_name, phone, notified_next_at").eq("shop_id", shopId).eq("status", "waiting").order("joined_at").order("id").limit(1).maybeSingle();
    if (!first || first.notified_next_at) return;
    await db.from("walkins").update({ notified_next_at: new Date().toISOString() }).eq("id", first.id);
    const base = siteUrl();
    await notify({
      shopId, template: "walkin_next", to: { phone: first.phone },
      data: { shopName: site.name, firstName: first.display_name.split(" ")[0] ?? "there", address: addressOneLine, phone: site.phoneDisplay, logoUrl: `${base}/brand/carlos-logo-web.png`, bookUrl: `${base}/book`, directionsUrl: site.googleMapsDirections, statusUrl: `${base}/line/${signToken("walkin", first.id)}` },
      walkinId: first.id,
    });
  } catch (e) {
    console.error("notifyNextInLine failed", e);
  }
}
