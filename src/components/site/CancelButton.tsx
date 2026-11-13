"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBookingAction } from "@/app/(site)/book/actions";

export function CancelButton({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming) return <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>Cancel booking</button>;
  return (
    <div role="alertdialog" aria-label="Confirm cancellation" style={{ width: "100%", background: "var(--c-red-tint)", border: "1px solid #e9b9bd", borderRadius: 8, padding: 14 }}>
      <p style={{ margin: "0 0 10px" }}>Cancel this booking? Someone else can then take the spot.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-red btn-sm" disabled={pending} onClick={() => start(async () => {
          const fd = new FormData(); fd.set("token", token);
          const r = await cancelBookingAction(fd);
          if (r.ok) router.refresh(); else setError(r.error);
        })}>{pending ? "Cancelling…" : "Yes, cancel it"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Keep it</button>
      </div>
    </div>
  );
}
