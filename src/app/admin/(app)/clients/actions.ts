"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/schemas/common";
import { phoneField } from "@/lib/schemas/common";
import { userClient } from "@/lib/supabase/server";

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
  const db = await userClient();
  const shopId = a.staff.profile.shop_id;

  const { data: existing } = await db.from("clients").select("phone, email").eq("shop_id", shopId);
  const havePhone = new Set((existing ?? []).map((c) => c.phone).filter(Boolean));
  const haveEmail = new Set((existing ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean));
  const fresh = p.data.rows.filter((r) => !(r.phone && havePhone.has(r.phone)) && !(r.email && haveEmail.has(r.email)));

  let added = 0;
  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500).map((r) => ({ shop_id: shopId, name: r.name, phone: r.phone, email: r.email, notes: r.notes, source: "import" as const }));
    const { error } = await db.from("clients").insert(chunk);
    if (error) return { ok: false, error: `Import stopped after ${added} clients: ${error.message}` };
    added += chunk.length;
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
  const db = await userClient();
  const { error } = await db.from("clients").update({ name: p.data.name, email: p.data.email || null, phone: p.data.phone || null, notes: p.data.notes || null }).eq("id", p.data.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Another client already has that phone number." : "Couldn't save." };
  revalidatePath(`/admin/clients/${p.data.id}`);
  return { ok: true };
}
