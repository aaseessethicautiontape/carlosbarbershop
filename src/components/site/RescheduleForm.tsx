"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rescheduleBookingAction } from "@/app/(site)/book/actions";
import { SlotPicker } from "./SlotPicker";

export function RescheduleForm({ token, serviceId, barberId, days, tz }: { token: string; serviceId: string; barberId: string; days: string[]; tz: string }) {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <SlotPicker serviceId={serviceId} barberId={barberId} days={days} tz={tz} value={value} onChange={setValue} />
      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div className="navrow">
        <span />
        <button type="button" className="btn btn-red" disabled={!value || pending} onClick={() => start(async () => {
          const r = await rescheduleBookingAction({ token, startsAt: value! });
          if (r.ok) router.push(`/book/confirmed/${token}`); else { setError(r.error); setValue(null); }
        })}>{pending ? "Saving…" : "Move my booking"}</button>
      </div>
    </div>
  );
}
