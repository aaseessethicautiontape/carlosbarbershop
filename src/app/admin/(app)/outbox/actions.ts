"use server";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { isMock } from "@/lib/env";
import { runReminders } from "@/lib/reminders";
import type { ActionResult } from "@/lib/schemas/common";

/** Mock-mode convenience: run the reminder job on demand instead of waiting for the cron. */
export async function runRemindersNowAction(): Promise<ActionResult<{ r24: number; r2: number }>> {
  if (!isMock()) return { ok: false, error: "Reminders run on the schedule in live mode." };
  const a = await authorize(["owner"]);
  if (!a.ok) return a;
  const r = await runReminders();
  revalidatePath("/admin/outbox");
  return { ok: true, ...r };
}
