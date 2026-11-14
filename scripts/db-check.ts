/**
 * Database guarantees, proven against the real Neon database:  pnpm db:check
 *  1. A role with only public access (public_reader) cannot read or write private data, or call intake functions.
 *  2. No double booking (exclusion constraint), hours / time-off / booking-window rules, reschedule, walk-in seating,
 *     rate limiter, and live mirrors (busy_blocks, queue_state, live_ticks) behave.
 * Test rows use phone numbers +1705555900x and are removed afterwards. Run against the DEMO database only.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (see .env.local)");
const sql = neon(url);
const SHOP = "00000000-0000-4000-8000-000000000001";
const CARLO = "00000000-0000-4000-8000-0000000000b1";
const COSMO = "00000000-0000-4000-8000-0000000000b2";
const HAIRCUT = "00000000-0000-4000-8000-0000000000a1";

let failures = 0;
const rows: Array<[string, string]> = [];
const record = (ok: boolean, what: string) => { rows.push([ok ? "PASS" : "FAIL", what]); if (!ok) failures++; };

/** Run SQL as the public_reader role inside a transaction. */
const asPublic = (text: string) => sql.transaction([sql.query("set local role public_reader"), sql.query(text)]);
const denied = async (what: string, text: string) => {
  try { await asPublic(text); record(false, `${what} (was allowed!)`); } catch (e) { record(/permission denied|row-level security/i.test(String(e)), `${what} -> denied`); }
};
const raises = async (what: string, text: string, params: unknown[], expect: string) => {
  try { await sql.query(text, params as never[]); record(false, `${what} (no error)`); } catch (e) { record(String(e).includes(expect), `${what} -> ${expect}`); }
};

async function main() {
  // ---- 1. public role
  for (const t of ["clients", "bookings", "walkins", "time_off", "notifications_log", "message_settings", "profiles", "rate_limits"]) await denied(`public_reader cannot read ${t}`, `select * from public.${t}`);
  await denied("public_reader cannot insert clients", `insert into public.clients (shop_id, name) values ('${SHOP}', 'x')`);
  await denied("public_reader cannot update services", "update public.services set price_cents = 1");
  await denied("public_reader cannot call create_booking", `select public.create_booking('${SHOP}','${CARLO}','${HAIRCUT}', now() + interval '2 days', 'x', '+17055550000')`);
  await denied("public_reader cannot call join_walkin", `select public.join_walkin('${SHOP}', 'x', '+17055550000')`);
  await denied("public_reader cannot call hit_rate_limit", "select public.hit_rate_limit('k', 60, 5)");
  const [, svc] = await asPublic("select count(*)::int as n from public.services");
  record((svc as { n: number }[])[0]!.n === 7, "public_reader can read the 7 shown services");
  const [, qs] = await asPublic("select * from public.queue_state");
  record(!Object.keys((qs as object[])[0] ?? {}).some((k) => /name|phone|email|client/.test(k)), "queue_state has no personal-data columns");
  const pii = (await sql.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name in ('queue_state','busy_blocks','live_ticks') and column_name ~ '(name|phone|email|client)'")) as { n: number }[];
  record(pii[0]!.n === 0, "public mirror tables have no PII columns");

  // ---- 2. booking rules (owner connection)
  const day = ((await sql.query("select ((date_trunc('week', (now() at time zone 'America/Toronto') + interval '7 days'))::date)::text as d")) as { d: string }[])[0]!.d;
  const at = async (hhmm: string, plusDays = 0) => ((await sql.query("select ((($1::date + $3::int) + $2::time) at time zone 'America/Toronto')::text as t", [day, hhmm, plusDays])) as { t: string }[])[0]!.t;
  const mon10 = await at("10:00"), mon1015 = await at("10:15"), mon8 = await at("08:00"), sun10 = await at("10:00", 6);
  const book = (b: string, start: string, name: string, phone: string) => sql.query("select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,$5,$6) as id", [SHOP, b, HAIRCUT, start, name, phone]);
  const cleanup = async () => {
    await sql.query("delete from bookings where client_id in (select id from clients where phone like '+170555590%')");
    await sql.query("delete from walkins where phone like '+170555590%'");
    await sql.query("delete from clients where phone like '+170555590%'");
    await sql.query("delete from time_off where reason = 'db-check'");
  };
  await cleanup();
  try {
    await book(CARLO, mon10, "T One", "+17055559001"); record(true, "first booking succeeds");
    await raises("same barber + same time", "select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,'T Two','+17055559002')", [SHOP, CARLO, HAIRCUT, mon10], "slot_taken");
    await raises("overlapping range", "select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,'T Two','+17055559002')", [SHOP, CARLO, HAIRCUT, mon1015], "slot_taken");
    await book(COSMO, mon10, "T Two", "+17055559002"); record(true, "a different barber at the same time is fine");
    await raises("raw insert bypassing the RPC", "insert into bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at) select $1::uuid, $2::uuid, $3::uuid, (select id from clients where phone = '+17055559001'), $4::timestamptz, $4::timestamptz + interval '20 min'", [SHOP, CARLO, HAIRCUT, mon10], "bookings_no_overlap");
    await raises("before opening hours", "select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,'E','+17055559003')", [SHOP, CARLO, HAIRCUT, mon8], "outside_hours");
    await raises("closed day (Sunday)", "select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz,'S','+17055559004')", [SHOP, CARLO, HAIRCUT, sun10], "outside_hours");
    await raises("inside minimum lead time", "select public.create_booking($1::uuid,$2::uuid,$3::uuid, now() + interval '5 minutes','L','+17055559005')", [SHOP, CARLO, HAIRCUT], "too_soon");
    await raises("beyond booking window", "select public.create_booking($1::uuid,$2::uuid,$3::uuid, now() + interval '90 days','F','+17055559006')", [SHOP, CARLO, HAIRCUT], "too_far");

    await sql.query("insert into time_off (shop_id, barber_id, starts_at, ends_at, reason) values ($1,$2,$3::timestamptz + interval '1 hour',$3::timestamptz + interval '3 hours','db-check')", [SHOP, COSMO, mon10]);
    await raises("time off blocks booking", "select public.create_booking($1::uuid,$2::uuid,$3::uuid,$4::timestamptz + interval '90 minutes','O','+17055559007')", [SHOP, COSMO, HAIRCUT, mon10], "barber_off");
    const tick0 = ((await sql.query("select n::int as n from live_ticks where scope='public'")) as { n: number }[])[0]!.n;
    await sql.query("update bookings set status='cancelled' where client_id = (select id from clients where phone='+17055559001')");
    const tick1 = ((await sql.query("select n::int as n from live_ticks where scope='public'")) as { n: number }[])[0]!.n;
    record(tick1 > tick0, "live_ticks bumps when a booking changes");
    await book(CARLO, mon10, "T Three", "+17055559008"); record(true, "a cancelled slot can be rebooked");
    await sql.query("select public.reschedule_booking((select id from bookings where client_id=(select id from clients where phone='+17055559008')), $1::timestamptz + interval '90 minutes')", [mon10]); record(true, "reschedule to a free slot");
    await raises("reschedule to an invalid time", "select public.reschedule_booking((select id from bookings where client_id=(select id from clients where phone='+17055559008')), $1::timestamptz + interval '12 hours')", [mon10], "outside_hours");

    // walk-in line + seating
    const before = ((await sql.query("select waiting_count::int as n from queue_state")) as { n: number }[])[0]!.n;
    const w = ((await sql.query("select public.join_walkin($1::uuid,'Pat','+17055559100') as id", [SHOP])) as { id: string }[])[0]!.id;
    const again = ((await sql.query("select public.join_walkin($1::uuid,'Pat','+17055559100') as id", [SHOP])) as { id: string }[])[0]!.id;
    record(w === again, "joining the line twice returns the same ticket");
    const st = ((await sql.query("select * from public.walkin_status($1::uuid)", [w])) as { queue_position: number; first_name: string }[])[0]!;
    record(st.queue_position === before + 1 && st.first_name === "Pat", "status shows position and first name only");
    await sql.query("update barbers set on_duty = true where id = $1", [CARLO]);
    await sql.query("delete from bookings where barber_id = $1 and tstzrange(starts_at, ends_at) @> now()", [CARLO]);
    await sql.query("select public.seat_walkin($1::uuid, $2::uuid)", [w, CARLO]); record(true, "a walk-in can be seated");
    await raises("seating into a taken chair", "select public.seat_walkin((select id from public.walkins where phone='+17055559100'), $1::uuid)", [CARLO], "not_waiting");
    const after = ((await sql.query("select waiting_count::int as n from queue_state")) as { n: number }[])[0]!.n;
    record(after === before, "queue_state shrinks after seating");
    await sql.query("update bookings set status='done' where barber_id=$1 and source='walk_in' and client_id=(select id from clients where phone='+17055559100')", [CARLO]);

    // rate limiter
    const hits = [] as boolean[];
    for (let i = 0; i < 3; i++) hits.push(((await sql.query("select public.hit_rate_limit('db-check', 60, 2) as ok")) as { ok: boolean }[])[0]!.ok);
    record(hits[0] === true && hits[1] === true && hits[2] === false, "rate limiter allows 2 then blocks the 3rd");
    await sql.query("delete from rate_limits where key = 'db-check'");
  } finally {
    await cleanup();
  }

  const w0 = Math.max(...rows.map((r) => r[1].length));
  for (const [s, what] of rows) console.log(`${s}  ${what.padEnd(w0)}`);
  console.log(failures ? `\n${failures} FAILED` : `\nAll ${rows.length} database checks passed.`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
