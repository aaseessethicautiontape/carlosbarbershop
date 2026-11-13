import { normalizePhone } from "@/lib/format";

/**
 * Client CSV import helpers (pure, shared by the browser preview and the server action).
 * The importer works with ANY export: the owner maps columns in the preview, we guess first.
 */
export const TARGETS = ["name", "first_name", "last_name", "phone", "email", "notes"] as const;
export type Target = (typeof TARGETS)[number];
export type Mapping = Partial<Record<Target, string>>; // target -> source header

const GUESSES: Record<Target, RegExp> = {
  name: /^(full[ _-]?name|client([ _-]?name)?|customer([ _-]?name)?|name)$/i,
  first_name: /^(first[ _-]?name|given[ _-]?name|fname)$/i,
  last_name: /^(last[ _-]?name|sur[ _-]?name|family[ _-]?name|lname)$/i,
  phone: /^(phone([ _-]?number)?|mobile|cell(phone)?|tel(ephone)?)$/i,
  email: /^(e[ _-]?mail([ _-]?address)?)$/i,
  notes: /^(notes?|comments?|memo)$/i,
};

export function guessMapping(headers: string[]): Mapping {
  const out: Mapping = {};
  for (const t of TARGETS) {
    const h = headers.find((x) => GUESSES[t].test(x.trim()));
    if (h) out[t] = h;
  }
  if (out.first_name && out.last_name) delete out.name; // prefer first+last when both exist
  return out;
}

export interface ImportRow { name: string; phone: string | null; email: string | null; notes: string | null }
export interface MappedResult { valid: ImportRow[]; invalid: Array<{ line: number; reason: string }>; duplicates: number }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function mapRows(rows: Array<Record<string, string>>, mapping: Mapping): MappedResult {
  const valid: ImportRow[] = [];
  const invalid: MappedResult["invalid"] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  const get = (r: Record<string, string>, t: Target) => (mapping[t] ? (r[mapping[t]!] ?? "").trim() : "");

  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const name = (get(r, "name") || `${get(r, "first_name")} ${get(r, "last_name")}`).replace(/\s+/g, " ").trim();
    const rawPhone = get(r, "phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const email = get(r, "email").toLowerCase();
    if (!name) return void invalid.push({ line, reason: "No name" });
    if (rawPhone && !phone) return void invalid.push({ line, reason: `Phone "${rawPhone}" isn't valid` });
    if (email && !EMAIL.test(email)) return void invalid.push({ line, reason: `Email "${email}" isn't valid` });
    if (!phone && !email) return void invalid.push({ line, reason: "Needs a phone or an email" });
    const key = phone ?? email;
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    valid.push({ name: name.slice(0, 120), phone, email: email || null, notes: get(r, "notes").slice(0, 500) || null });
  });
  return { valid, invalid, duplicates };
}
