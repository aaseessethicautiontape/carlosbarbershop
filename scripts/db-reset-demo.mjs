// DEMO ONLY: wipes the demo database's app data and reloads db/seed.sql + demo staff profiles. Refuses when NEXT_PUBLIC_APP_MODE=live.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
if (process.env.NEXT_PUBLIC_APP_MODE === "live") throw new Error("Refusing to reset a LIVE database.");
const sql = neon(process.env.DATABASE_URL);
const split = (text) => { const out = []; let cur = ""; let d = false; for (const line of text.split("\n")) { const t = line.trim(); if (t.startsWith("--") && !d) continue; cur += line + "\n"; if ((line.match(/\$\$/g) ?? []).length % 2 === 1) d = !d; if (!d && /;\s*(--[^']*)?$/.test(t)) { out.push(cur.trim()); cur = ""; } } if (cur.trim()) out.push(cur.trim()); return out; };
await sql.query("truncate public.shops, public.notifications_log, public.rate_limits cascade");
await sql.transaction((tx) => split(readFileSync("db/seed.sql", "utf8")).map((s) => tx.query(s)));
await sql.transaction((tx) => split(readFileSync("db/demo-profiles.sql", "utf8")).map((s) => tx.query(s)));
console.log("Demo data reset.");
