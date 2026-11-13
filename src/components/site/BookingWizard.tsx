"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { createBookingAction } from "@/app/(site)/book/actions";
import { formatPrice } from "@/lib/format";
import { HONEYPOT_FIELD } from "@/lib/turnstile-shared";
import { SlotPicker } from "./SlotPicker";
import { TurnstileField } from "./TurnstileField";

export interface WizardService { id: string; name: string; label: string; price_cents: number | null }
export interface WizardBarber { id: string; name: string; initials: string; serviceIds: string[] }
interface Props { services: WizardService[]; barbers: WizardBarber[]; days: string[]; tz: string }

const STEPS = ["Service", "Barber", "Time", "Details"] as const;

/** 4 steps: service → barber (or first available) → date + time → your details, then confirm. */
export function BookingWizard({ services, barbers, days, tz }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const preSvc = services.find((s) => s.id === params.get("service"))?.id ?? null;
  const preBarber = barbers.find((b) => b.id === params.get("barber"))?.id ?? null;

  const [step, setStep] = useState(preSvc && preBarber ? 3 : preSvc ? 2 : 1);
  const [svc, setSvc] = useState<string | null>(preSvc);
  const [barber, setBarber] = useState<string | null>(preBarber);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const service = services.find((s) => s.id === svc) ?? null;
  const available = useMemo(() => barbers.filter((b) => !svc || b.serviceIds.includes(svc)), [barbers, svc]);
  const chosenBarber = barber === "any" ? { name: "Any barber" } : barbers.find((b) => b.id === barber);
  const reach = [true, !!svc, !!svc && !!barber, !!svc && !!barber && !!startsAt];
  const ok = [!!svc, !!barber, !!startsAt, name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10];
  const onSlot = useCallback((iso: string | null) => { setStartsAt(iso); if (iso) setGone(false); }, []);

  const when = startsAt ? new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(startsAt)) : "";

  function submit(form: HTMLFormElement) {
    setError(null); setFields({});
    const fd = new FormData(form);
    fd.set("serviceId", svc!); fd.set("barberId", barber!); fd.set("startsAt", startsAt!);
    start(async () => {
      const res = await createBookingAction(fd);
      if (res.ok) router.push(`/book/confirmed/${res.token}`);
      else { setError(res.error); setFields(res.fields ?? {}); if (/grabbed|taken/i.test(res.error)) { setStartsAt(null); setStep(3); } }
    });
  }

  return (
    <div className="card">
      <div className="steps" role="group" aria-label="Booking steps">
        {STEPS.map((l, i) => (
          <button type="button" key={l} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""} disabled={!reach[i] || pending} aria-current={step === i + 1 ? "step" : undefined} onClick={() => setStep(i + 1)}>
            {i + 1}. {l}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="fade">
          <h2 className="q">What are we doing today?</h2>
          <div className="list">
            {services.map((s) => (
              <button type="button" key={s.id} className={s.id === svc ? "opt on" : "opt"} aria-pressed={s.id === svc} onClick={() => { setSvc(s.id); if (barber && barber !== "any" && !barbers.find((b) => b.id === barber)?.serviceIds.includes(s.id)) setBarber(null); setStartsAt(null); }}>
                <span><b>{s.name}</b><br /><small>{s.label}</small></span><b>{formatPrice(s.price_cents)}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fade">
          <h2 className="q">Who&apos;s cutting?</h2>
          <div className="grid2">
            <button type="button" className={barber === "any" ? "opt on" : "opt"} aria-pressed={barber === "any"} onClick={() => { setBarber("any"); setStartsAt(null); }} style={{ minHeight: 62 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="ini" aria-hidden="true">★</span><span><b>Any barber</b><br /><small>First chair free</small></span></span>
            </button>
            {available.map((b) => (
              <button type="button" key={b.id} className={barber === b.id ? "opt on" : "opt"} aria-pressed={barber === b.id} onClick={() => { setBarber(b.id); setStartsAt(null); }} style={{ minHeight: 62 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="ini" aria-hidden="true">{b.initials}</span><b>{b.name}</b></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && svc && barber && (
        <div className="fade">
          <h2 className="q">Pick a day and time</h2>
          {gone && <p className="form-error" role="alert" style={{ marginBottom: 12 }}>Someone just grabbed that time. Pick another.</p>}
          <SlotPicker serviceId={svc} barberId={barber} days={days} tz={tz} value={startsAt} onChange={onSlot} onGone={() => setGone(true)} />
        </div>
      )}

      {step === 4 && (
        <form className="fade" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} noValidate>
          <h2 className="q">Almost done</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field">Name<input name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last" required />{fields.name && <span className="err">{fields.name}</span>}</label>
            <div className="grid2">
              <label className="field">Phone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="705 555 0123" required />{fields.phone && <span className="err">{fields.phone}</span>}</label>
              <label className="field">Email (optional)<input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="for your confirmation" />{fields.email && <span className="err">{fields.email}</span>}</label>
            </div>
            <div className="hp" aria-hidden="true"><label>Leave this empty<input name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" /></label></div>
            <TurnstileField />
            <p style={{ margin: 0, fontSize: 13, color: "var(--c-muted)" }}>You&apos;ll get a confirmation and a reminder the day before. Pay at the shop.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="navrow">
            <span className="total">{service?.name} · {chosenBarber?.name}<br /><b style={{ fontSize: 16 }}>{when}</b></span>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>Back</button>
              <button type="submit" className="btn btn-red" disabled={!ok[3] || pending}>{pending ? "Booking…" : "Confirm booking"}</button>
            </div>
          </div>
        </form>
      )}

      {step < 4 && (
        <div className="navrow">
          <span className="total">{service ? `${service.name}${chosenBarber ? ` · ${chosenBarber.name}` : ""}` : "Pick a service"}<b>{service ? formatPrice(service.price_cents) : ""}</b></span>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 && <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
            <button type="button" className="btn btn-red" disabled={!ok[step - 1]} onClick={() => setStep(step + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
