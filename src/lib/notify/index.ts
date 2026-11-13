import "server-only";
import { isMock, publicEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import type { TemplateKey } from "@/lib/supabase/types";
import { renderTemplate, type MessageData } from "./templates";
import { sendEmail } from "./resend";
import { sendSms } from "./sms";

/**
 * THE notification adapter. Everything that emails or texts a customer goes through notify().
 *  - mock mode: nothing leaves the machine. Messages are rendered and written to notifications_log
 *    (status "logged"), which is what /admin/outbox shows.
 *  - live mode: Resend for email; SMS provider stub (not configured yet). Every attempt is logged.
 */
export interface Recipient { email?: string | null; phone?: string | null }

export interface NotifyArgs {
  shopId: string;
  template: TemplateKey;
  to: Recipient;
  data: MessageData;
  bookingId?: string;
  walkinId?: string;
  /** Manual "send now" from the admin: ignore the on/off toggles, use whatever channel the client has. */
  manual?: boolean;
}

export interface NotifyResult { channel: "email" | "sms"; status: "logged" | "sent" | "failed"; error?: string }

export async function notify(args: NotifyArgs): Promise<NotifyResult[]> {
  const db = adminClient();
  const { data: setting } = await db.from("message_settings").select("email_enabled, sms_enabled").eq("shop_id", args.shopId).eq("template_key", args.template).maybeSingle();

  let wantEmail = !!setting?.email_enabled;
  let wantSms = !!setting?.sms_enabled;
  if (args.manual) {
    wantEmail = !!args.to.email;
    wantSms = !args.to.email && !!args.to.phone;
  }
  const doEmail = wantEmail && !!args.to.email;
  const doSms = wantSms && !!args.to.phone;
  if (!doEmail && !doSms) return [];

  const rendered = await renderTemplate(args.template, args.data);
  const results: NotifyResult[] = [];

  const record = async (channel: "email" | "sms", to: string, status: NotifyResult["status"], extra: { providerId?: string; error?: string } = {}) => {
    await db.from("notifications_log").insert({
      shop_id: args.shopId, template_key: args.template, channel, to_address: to,
      subject: channel === "email" ? rendered.subject : null, body: channel === "email" ? rendered.text : rendered.sms,
      status, provider_id: extra.providerId ?? null, error: extra.error ?? null,
      booking_id: args.bookingId ?? null, walkin_id: args.walkinId ?? null,
    });
    results.push({ channel, status, error: extra.error });
  };

  if (doEmail) {
    const to = args.to.email!;
    if (isMock()) await record("email", to, "logged");
    else {
      const r = await sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
      await record("email", to, r.ok ? "sent" : "failed", { providerId: r.id, error: r.error });
    }
  }
  if (doSms) {
    const to = args.to.phone!;
    if (isMock()) await record("sms", to, "logged");
    else {
      const r = await sendSms({ to, body: rendered.sms });
      await record("sms", to, r.ok ? "sent" : "failed", { providerId: r.id, error: r.error });
    }
  }
  return results;
}

/** Absolute URLs used inside messages. */
export const siteUrl = () => publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
