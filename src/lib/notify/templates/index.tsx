import { render } from "@react-email/render";
import { EmailFrame } from "./layout";
import type { TemplateKey } from "@/lib/supabase/types";

export interface MessageData {
  shopName: string;
  firstName: string;
  address: string;
  phone: string;
  logoUrl: string;
  bookUrl: string;
  directionsUrl: string;
  serviceName?: string;
  barberName?: string;
  whenLabel?: string;
  priceLabel?: string;
  manageUrl?: string;
  calendarUrl?: string;
  statusUrl?: string;
  waitMinutes?: number;
}

export const TEMPLATE_KEYS: TemplateKey[] = ["confirmation", "reminder_24h", "reminder_2h", "walkin_next", "come_back"];

export const TEMPLATE_META: Record<TemplateKey, { label: string; when: string; defaultChannels: string }> = {
  confirmation: { label: "Booking confirmation", when: "Sent right after they book", defaultChannels: "email" },
  reminder_24h: { label: "Reminder, day before", when: "Sent 24 hours before the appointment", defaultChannels: "email" },
  reminder_2h: { label: "Reminder, 2 hours before", when: "Sent 2 hours before the appointment", defaultChannels: "email" },
  walkin_next: { label: "Walk-in, you're next", when: "When they reach the front of the line", defaultChannels: "text" },
  come_back: { label: "Come back reminder", when: "Sent 4 weeks after a visit", defaultChannels: "email" },
};

interface Content { chip: string; subject: string; title: string; body: string; cta: string; ctaHref: (d: MessageData) => string | undefined; sms: (d: MessageData) => string }

const CONTENT: Record<TemplateKey, Content> = {
  confirmation: {
    chip: "Confirmed", subject: "You're booked in at Carlo's", title: "You're booked in.",
    body: "Thanks for booking with Carlo's. Here are your details. See you soon!", cta: "Add to calendar", ctaHref: (d) => d.calendarUrl,
    sms: (d) => `Carlo's: you're booked, ${d.firstName}. ${d.serviceName} with ${d.barberName}, ${d.whenLabel}. ${d.manageUrl ?? ""}`.trim(),
  },
  reminder_24h: {
    chip: "Reminder", subject: "See you tomorrow at Carlo's", title: "See you tomorrow.",
    body: "Just a reminder about your appointment tomorrow. Tap below if anything changes.", cta: "Manage booking", ctaHref: (d) => d.manageUrl,
    sms: (d) => `Carlo's reminder: ${d.serviceName} with ${d.barberName} tomorrow, ${d.whenLabel}. Change it: ${d.manageUrl ?? ""}`.trim(),
  },
  reminder_2h: {
    chip: "Today", subject: "See you in 2 hours at Carlo's", title: "See you in 2 hours.",
    body: "Your chair is ready soon. See you at the shop.", cta: "Get directions", ctaHref: (d) => d.directionsUrl,
    sms: (d) => `Carlo's: see you in 2 hours, ${d.whenLabel}, ${d.address}.`,
  },
  walkin_next: {
    chip: "You're next", subject: "You're next at Carlo's", title: "Head over now.",
    body: "Your barber will be free in about 5 minutes. Show this message at the front.", cta: "See my place in line", ctaHref: (d) => d.statusUrl,
    sms: (d) => `Carlo's: you're next, ${d.firstName}! Head over now. ${d.statusUrl ?? ""}`.trim(),
  },
  come_back: {
    chip: "Time for a cut", subject: "Looking a little shaggy?", title: "Looking a little shaggy?",
    body: "It's been about a month since your last cut. Grab your usual time with one tap.", cta: "Book again", ctaHref: (d) => d.bookUrl,
    sms: (d) => `Carlo's: it's been a month, ${d.firstName}. Book your next cut: ${d.bookUrl}`,
  },
};

function Details({ d }: { d: MessageData }) {
  if (!d.serviceName) return null;
  return (
    <div style={{ background: "#FAF5EC", border: "1px solid #E3D8C6", borderRadius: 8, padding: "12px 14px", margin: "14px 0", fontSize: 14, lineHeight: 1.6 }}>
      <b>{d.serviceName}</b>
      {d.barberName ? ` with ${d.barberName}` : ""}
      {d.whenLabel ? <><br />{d.whenLabel}{d.priceLabel ? ` · ${d.priceLabel}` : ""}</> : null}
      <br />
      <span style={{ color: "#6E6253" }}>{d.address}</span>
    </div>
  );
}

export function EmailFor({ template, data }: { template: TemplateKey; data: MessageData }) {
  const c = CONTENT[template];
  const href = c.ctaHref(data);
  const secondary = template === "confirmation" && data.manageUrl ? [{ label: "Reschedule or cancel", href: data.manageUrl }] : undefined;
  return (
    <EmailFrame preview={c.title} chip={c.chip} title={c.title} logoUrl={data.logoUrl} cta={href ? { label: c.cta, href } : undefined} secondary={secondary}
      footer="Can't make it? Please let us know so someone else can take your spot.">
      <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.6 }}>Hi {data.firstName}. {c.body}</p>
      <Details d={data} />
    </EmailFrame>
  );
}

export interface Rendered { subject: string; html: string; text: string; sms: string }

export async function renderTemplate(template: TemplateKey, data: MessageData): Promise<Rendered> {
  const c = CONTENT[template];
  const el = <EmailFor template={template} data={data} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: c.subject, html, text, sms: c.sms(data) };
}
