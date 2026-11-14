import "server-only";
import { addressOneLine, site } from "@/content/site";
import { one } from "@/lib/db";
import { notify, siteUrl } from "@/lib/notify";
import { signToken } from "@/lib/tokens";

/**
 * "You're up next" text. Called after anything that moves the line (join, seat, remove, duty toggle).
 * Texts the person at position 1 once (notified_next_at guards against repeats), only when a chair is free.
 */
export async function notifyNextInLine(shopId: string): Promise<void> {
  try {
    const state = await one<{ free_chairs: number }>("select free_chairs from queue_state where shop_id = $1", [shopId]);
    if (!state || state.free_chairs < 1) return;
    // Claim atomically so two overlapping calls never text the same person twice.
    const first = await one<{ id: string; display_name: string; phone: string | null }>(
      `update walkins set notified_next_at = now()
       where id = (select id from walkins where shop_id = $1 and status = 'waiting' order by joined_at, id limit 1) and notified_next_at is null
       returning id, display_name, phone`,
      [shopId],
    );
    if (!first) return;
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

