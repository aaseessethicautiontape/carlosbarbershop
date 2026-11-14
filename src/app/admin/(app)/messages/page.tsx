import { MessageToggles } from "@/components/admin/MessageToggles";
import { addressOneLine, site } from "@/content/site";
import { requireStaff } from "@/lib/auth/session";
import { renderTemplate, TEMPLATE_KEYS, TEMPLATE_META, type MessageData } from "@/lib/notify/templates";
import { siteUrl } from "@/lib/notify";
import { q } from "@/lib/db";
import type { TemplateKey } from "@/lib/dbtypes/types";

export const metadata = { title: "Emails & texts" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const staff = await requireStaff(["owner"]);
  const sp = await searchParams;
  const selected = (TEMPLATE_KEYS as string[]).includes(sp.t ?? "") ? (sp.t as TemplateKey) : "confirmation";
  const data = await q<{ template_key: string; email_enabled: boolean; sms_enabled: boolean }>("select template_key, email_enabled, sms_enabled from message_settings where shop_id = $1", [staff.profile.shop_id]);
  const base = siteUrl();
  const sample: MessageData = {
    shopName: site.name, firstName: "Mark", address: addressOneLine, phone: site.phoneDisplay, logoUrl: `${base}/brand/carlos-logo-web.png`, bookUrl: `${base}/book`, directionsUrl: site.googleMapsDirections,
    serviceName: "Haircut and beard trim", barberName: "Estella", whenLabel: "Friday, Nov 14 at 2:30 pm", priceLabel: "[PRICE]", manageUrl: `${base}/b/sample`, calendarUrl: `${base}/api/calendar/sample`, statusUrl: `${base}/line/sample`,
  };
  const rendered = await renderTemplate(selected, sample);
  return (
    <>
      <header className="top"><div><h1>Emails &amp; texts</h1><small>Turn each message on or off and see exactly what customers get. Texts need an SMS provider (see TODO-LIVE).</small></div></header>
      <div className="body">
        <div className="grid-a" style={{ alignItems: "start" }}>
          <MessageToggles rows={TEMPLATE_KEYS.map((k) => ({ key: k, label: TEMPLATE_META[k].label, when: TEMPLATE_META[k].when, email: data.find((d) => d.template_key === k)?.email_enabled ?? false, sms: data.find((d) => d.template_key === k)?.sms_enabled ?? false, selected: k === selected }))} />
          <div className="mail">
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Preview · {TEMPLATE_META[selected].label}</p>
            <iframe title="Email preview" sandbox="" srcDoc={rendered.html} />
            <p style={{ margin: "10px 0 0", fontSize: 13 }}><b>Text version:</b> {rendered.sms}</p>
          </div>
        </div>
      </div>
    </>
  );
}
