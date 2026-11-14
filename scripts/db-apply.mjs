// Applies db/migrations/*.sql (in order) to DATABASE_URL, tracking what ran. Add --seed to also load db/seed.sql (DEMO DATA ONLY).
import { readdirSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (run with: node --env-file=.env.local scripts/db-apply.mjs)");
const sql = neon(url);
const run = (text) => sql.query(text);

await run("create table if not exists public._migrations (name text primary key, ran_at timestamptz not null default now())");
const done = new Set((await sql.query("select name from public._migrations")).map((r) => r.name));
for (const f of readdirSync("db/migrations").filter((x) => x.endsWith(".sql")).sort()) {
  if (done.has(f)) { console.log(`skip  ${f}`); continue; }
  // The driver runs one statement per call, so split on statement boundaries that end with ";" at end of line, keeping $$ blocks intact.
  const text = readFileSync(`db/migrations/${f}`, "utf8");
  await sql.transaction((tx) => splitSql(text).map((s) => tx.query(s)));
  await run("insert into public._migrations (name) values ($1)".replace("$1", `'${f}'`));
  console.log(`apply ${f}`);
}
if (process.argv.includes("--seed")) {
  await sql.transaction((tx) => splitSql(readFileSync("db/seed.sql", "utf8")).map((s) => tx.query(s)));
  console.log("seeded db/seed.sql (demo data)");
}

function splitSql(text) {
  const out = []; let cur = ""; let dollar = false;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("--") && !dollar) continue;
    cur += line + "\n";
    const marks = (line.match(/\$\$/g) ?? []).length;
    if (marks % 2 === 1) dollar = !dollar;
    if (!dollar && /;\s*(--[^']*)?$/.test(t)) { out.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
