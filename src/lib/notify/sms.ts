import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * SMS provider stub. No provider is chosen yet (see TODO-LIVE.md). Twilio-shaped on purpose:
 * implement the fetch below once SMS_PROVIDER / SMS_API_KEY / SMS_FROM_NUMBER exist.
 */
export async function sendSms(_msg: { to: string; body: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const env = serverEnv();
  if (!env.SMS_PROVIDER || !env.SMS_API_KEY || !env.SMS_FROM_NUMBER) return { ok: false, error: "SMS provider not configured" };
  return { ok: false, error: `SMS provider "${env.SMS_PROVIDER}" is not implemented yet` };
}
