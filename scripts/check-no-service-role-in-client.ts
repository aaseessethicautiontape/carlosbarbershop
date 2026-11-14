/**
 * Build-time guard: no server secret (DB URL, realtime secret, cookie secret...) may ship to the browser.
 * Run after `pnpm build`:  pnpm check:secrets
 * 1. Greps every file under .next/static (what browsers download) for the actual key value and for the env var name.
 * 2. Greps src/components for imports of server-only modules.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const needles = ["DATABASE_URL", "NEON_REALTIME_SECRET", "NEON_AUTH_COOKIE_SECRET", "APP_TOKEN_SECRET", "TURNSTILE_SECRET_KEY", "RESEND_API_KEY"];
try {
  const env = readFileSync(join(root, ".env.local"), "utf8");
  for (const key of ["DATABASE_URL", "NEON_REALTIME_SECRET", "NEON_AUTH_COOKIE_SECRET"]) {
    const m = new RegExp(`^${key}=(.+)$`, "m").exec(env);
    if (m?.[1]) needles.push(m[1].trim());
  }
} catch {
  /* no .env.local: still check names */
}

let bad = 0;
for (const file of walk(join(root, ".next", "static")).filter((f) => /\.(js|css|html|json|map)$/.test(f))) {
  const text = readFileSync(file, "utf8");
  for (const n of needles) if (text.includes(n)) { console.error(`LEAK: "${n.slice(0, 12)}…" found in ${file.replace(root, ".")}`); bad++; }
}
for (const file of walk(join(root, "src", "components"))) {
  if (/@\/lib\/(db|env\.server|auth\/neon|live)["']/.test(readFileSync(file, "utf8"))) { console.error(`FORBIDDEN server-only import in ${file.replace(root, ".")}`); bad++; }
}
if (bad) process.exit(1);
console.log("OK: no server secrets in the client bundle, and no component imports a server-only module.");
