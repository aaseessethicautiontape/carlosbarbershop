"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/session";
import { q } from "@/lib/db";
import type { ActionResult } from "@/lib/schemas/common";
import { phoneField } from "@/lib/schemas/common";

const importRow = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable(),
  email: z.email().max(160).nullable(),
  notes: z.string().max(500).nullable(),
});
const importSchema = z.object({ rows: z.array(importRow).min(1).max(5000) });

/** Owner-only. Inserts new clients; anyone whose phone or email already exists is skipped (never overwritten). */
export async function importClientsAction(input: z.input<typeof importSchema>): Promise<ActionResult<{ added: number; skipped: number }>> {
  const a = await authorize(["owner"]);
  if (!a.ok) return a;
  const p = importSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "That file has rows we can't read. Re-check the column mapping." };
  const shopId = a.staff.profile.shop_id;

  const existing = await q<{ phone: string | null; email: string | null }>("select phone, email from clients where shop_id = $1", [shopId]);
  const havePhone = new Set(existing.map((c) => c.phone).filter(Boolean));
  const haveEmail = new Set(existing.map((c) => c.email?.toLowerCase()).filter(Boolean));
  const fresh = p.data.rows.filter((r) => !(r.phone && havePhone.has(r.phone)) && !(r.email && haveEmail.has(r.email)));

  let added = 0;
  for (let i = 0; i < fresh.length; i += 500) {
    const c = fresh.slice(i, i + 500);
    try {
      await q(
        "insert into clients (shop_id, name, phone, email, notes, source) select $1::uuid, n, p, e, t, 'import' from unnest($2::text[], $3::text[], $4::text[], $5::text[]) as x(n, p, e, t)",
        [shopId, c.map((r) => r.name), c.map((r) => r.phone), c.map((r) => r.email), c.map((r) => r.notes)],
      );
    } catch (e) {
      return { ok: false, error: `Import stopped after ${added} clients: ${e instanceof Error ? e.message : "database error"}` };
    }
    added += c.length;
  }
  revalidatePath("/admin/clients");
  return { ok: true, added, skipped: p.data.rows.length - added };
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.email().max(160)]),
  phone: z.union([z.literal(""), phoneField]),
  notes: z.string().max(1000),
});

export async function updateClientAction(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const a = await authorize();
  if (!a.ok) return a;
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the fields." };
  try {
    await q("update clients set name = $2, email = $3, phone = $4, notes = $5 where id = $1 and shop_id = $6", [p.data.id, p.data.name, p.data.email || null, p.data.phone || null, p.data.notes || null, a.staff.profile.shop_id]);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.includes("clients_phone_unique") ? "Another client already has that phone number." : "Couldn't save." };
  }
  revalidatePath(`/admin/clients/${p.data.id}`);
  return { ok: true };
}
