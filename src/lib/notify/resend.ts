import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env.server";

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const env = serverEnv();
    const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.NOTIFY_FROM_EMAIL!, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    return error ? { ok: false, error: error.message } : { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email failed" };
  }
}
