/**
 * DEMO ONLY. Creates the two demo staff logins in Neon Auth (owner + barber) and links them to staff profiles.
 * Needs DATABASE_URL, NEON_AUTH_BASE_URL, DEMO_* in the environment:  pnpm demo:setup
 * Never run this against the live project.
 */
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, NEON_AUTH_BASE_URL, NEXT_PUBLIC_SITE_URL, DEMO_OWNER_EMAIL, DEMO_BARBER_EMAIL, DEMO_PASSWORD } = process.env;
if (!DATABASE_URL || !NEON_AUTH_BASE_URL || !DEMO_OWNER_EMAIL || !DEMO_BARBER_EMAIL || !DEMO_PASSWORD) throw new Error("Missing DATABASE_URL, NEON_AUTH_BASE_URL, DEMO_OWNER_EMAIL, DEMO_BARBER_EMAIL or DEMO_PASSWORD.");

const origin = NEXT_PUBLIC_SITE_URL ?? "http://localhost:3470";
const sql = neon(DATABASE_URL);

for (const [email, name] of [[DEMO_OWNER_EMAIL, "Demo owner"], [DEMO_BARBER_EMAIL, "Demo barber"]] as const) {
  const res = await fetch(`${NEON_AUTH_BASE_URL}/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", Origin: origin }, body: JSON.stringify({ email, password: DEMO_PASSWORD, name }) });
  console.log(`${email}: ${res.ok ? "created" : `already exists or refused (${res.status})`}`);
}

await sql.query(
  `insert into public.profiles (id, shop_id, role, display_name, barber_id)
   select u.id::uuid, '00000000-0000-4000-8000-000000000001', case when u.email = $1 then 'owner'::public.app_role else 'barber'::public.app_role end,
          case when u.email = $1 then 'Carlo S.' else 'Estella' end,
          case when u.email = $1 then '00000000-0000-4000-8000-0000000000b1'::uuid else '00000000-0000-4000-8000-0000000000b4'::uuid end
   from neon_auth."user" u where u.email in ($1, $2) on conflict (id) do nothing`,
  [DEMO_OWNER_EMAIL, DEMO_BARBER_EMAIL],
);
console.log("Demo profiles linked.");
