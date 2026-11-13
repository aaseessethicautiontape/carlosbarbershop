/**
 * Proves the public (anon-key) API cannot read or write private data. Talks to the REST API exactly
 * like a browser would. Run against local Supabase:  pnpm rls:check
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.local).");

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const SHOP = "00000000-0000-4000-8000-000000000001";
let failures = 0;
const rows: Array<[string, string, string]> = [];

function record(ok: boolean, what: string, detail: string) {
  rows.push([ok ? "PASS" : "FAIL", what, detail]);
  if (!ok) failures++;
}

/** Private table: anon must get an error or zero rows, never data. */
async function mustNotRead(table: string) {
  const { data, error } = await anon.from(table).select("*").limit(5);
  const leaked = Array.isArray(data) && data.length > 0;
  record(!leaked, `anon SELECT ${table}`, error ? `denied (${error.code})` : `${data?.length ?? 0} rows`);
}

async function mustRead(table: string, min = 1) {
  const { data, error } = await anon.from(table).select("*").limit(50);
  record(!error && (data?.length ?? 0) >= min, `anon SELECT ${table} (public)`, error ? error.message : `${data?.length} rows`);
  return data ?? [];
}

async function mustNotWrite(what: string, run: () => PromiseLike<{ error: { code?: string; message: string } | null; data?: unknown }>) {
  const { error, data } = await run();
  const wrote = !error && Array.isArray(data) && data.length > 0;
  record(!!error || !wrote, what, error ? `denied (${error.code ?? error.message})` : "no rows affected");
}

async function main() {
  for (const t of ["clients", "bookings", "walkins", "time_off", "notifications_log", "message_settings", "profiles", "rate_limits"]) {
    await mustNotRead(t);
  }
  const { error: viewErr, data: viewData } = await anon.from("walkins_ranked").select("*").limit(1);
  record(!(viewData && viewData.length), "anon SELECT walkins_ranked", viewErr ? `denied (${viewErr.code})` : "0 rows");

  await mustRead("services", 7);
  await mustRead("barbers", 7);
  await mustRead("working_hours", 6);
  await mustRead("shops", 1);
  const q = await mustRead("queue_state", 1);
  record(q.every((r) => !("display_name" in r) && !("phone" in r)), "queue_state carries no personal data", Object.keys(q[0] ?? {}).join(", "));
  const blocks = await mustRead("busy_blocks", 0);
  record(blocks.every((r) => !("client_id" in r) && !("phone" in r)), "busy_blocks carries no personal data", Object.keys(blocks[0] ?? { none: 1 }).join(", "));

  await mustNotWrite("anon INSERT clients", () => anon.from("clients").insert({ shop_id: SHOP, name: "x" }).select());
  await mustNotWrite("anon INSERT bookings", () => anon.from("bookings").insert({ shop_id: SHOP }).select());
  await mustNotWrite("anon INSERT walkins", () => anon.from("walkins").insert({ shop_id: SHOP, display_name: "x" }).select());
  await mustNotWrite("anon UPDATE services", () => anon.from("services").update({ price_cents: 1 }).eq("shop_id", SHOP).select());
  await mustNotWrite("anon UPDATE barbers", () => anon.from("barbers").update({ on_duty: false }).eq("shop_id", SHOP).select());
  await mustNotWrite("anon DELETE queue_state", () => anon.from("queue_state").delete().eq("shop_id", SHOP).select());
  await mustNotWrite("anon RPC create_booking", () => anon.rpc("create_booking", { p_shop: SHOP, p_barber: SHOP, p_service: SHOP, p_starts: new Date(Date.now() + 864e5).toISOString(), p_name: "x", p_phone: "+17055550000" }) as never);
  await mustNotWrite("anon RPC join_walkin", () => anon.rpc("join_walkin", { p_shop: SHOP, p_name: "x", p_phone: "+17055550000" }) as never);
  await mustNotWrite("anon RPC hit_rate_limit", () => anon.rpc("hit_rate_limit", { p_key: "x", p_window_seconds: 60, p_max: 1 }) as never);

  // Sanity: the same API with a staff login DOES see clients, so the denials above are real policy, not a broken setup.
  const email = process.env.DEMO_OWNER_EMAIL;
  const password = process.env.DEMO_OWNER_PASSWORD;
  if (email && password) {
    const staff = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { error } = await staff.auth.signInWithPassword({ email, password });
    if (error) record(false, "sanity: demo owner sign-in", error.message);
    else {
      const { data } = await staff.from("clients").select("id").limit(1);
      record((data?.length ?? 0) > 0, "sanity: signed-in owner CAN read clients", `${data?.length ?? 0} rows`);
    }
  }

  const w = Math.max(...rows.map((r) => r[1].length));
  for (const [s, what, detail] of rows) console.log(`${s}  ${what.padEnd(w)}  ${detail}`);
  console.log(failures ? `\n${failures} FAILED` : `\nAll ${rows.length} checks passed: anonymous users cannot read or write private data.`);
  process.exit(failures ? 1 : 0);
}
main();
