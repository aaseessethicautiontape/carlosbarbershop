import { z } from "zod";
import { normalizePhone } from "@/lib/format";

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .transform((s, ctx) => {
    const p = normalizePhone(s);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, like 705 555 0123" });
      return z.NEVER;
    }
    return p;
  });

export const nameField = z.string().trim().min(1, "Please enter your name").max(80);
export const optionalEmail = z.union([z.literal(""), z.email("That email doesn't look right").max(160)]).optional();

/** Flatten Zod issues to { field: "first message" } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; fields?: Record<string, string> };
