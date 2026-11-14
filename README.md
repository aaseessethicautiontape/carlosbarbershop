# Carlo's Barbershop: website + admin 

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · **Neon** (Postgres 18, Managed Better Auth, Realtime) · Zod · Resend + React Email · pnpm.

This round is a **clickable mock** built on the real architecture. Everything works end to end on seeded data; going live is configuration plus the items in [`TODO-LIVE.md`](TODO-LIVE.md). The original plan is in [`PLAN.md`](PLAN.md) (see its "Neon port" note for what changed).

## What's in it

| Public site | Admin (`/admin`) |
|---|---|
| Home with the **live walk-in wait** card, menu board, barbers, reviews, hours | **Today**: one column per barber, on/off-duty toggles, click a booking for in chair / done / no-show / send reminder |
| `/book`: four-step booking from real, live availability | **Walk-in line**: live list, "Seat" in a chair, remove, add by name |
| Confirmation page, add-to-calendar (.ics), cancel + reschedule by signed link | **Clients**: search, detail with visit history, **CSV import** with column-mapping preview |
| `/line`: join the walk-in line, then a live "You're #3" page | **Services & prices**, **Barbers** (hours, days off, services), **Emails & texts** (toggles + previews), **Settings** |
| `/services`, `/barbers`, `/visit` | **Outbox** (mock mode): every email/text the app would send |

Realtime (Neon Realtime live SQL): seat a walk-in on one screen and it disappears from every other admin screen; the public wait card and a customer's "#3" page update at the same moment. Two people can't take the same slot (database exclusion constraint, not just the UI).

## Run it on your computer (no Vercel account, no Docker)

You only need Node 20+ and pnpm. The database lives in a hosted Neon demo project, so there is nothing to install for it.

```bash
pnpm install
# put the Neon values in .env.local (see .env.example). The person who set up the project has them.
pnpm dev                                      # http://localhost:3470 (development)
# or the fast production build, what a visitor would get:
pnpm demo                                     # builds, then serves http://localhost:3470
```

- Public site: <http://localhost:3470>
- Admin: <http://localhost:3470/admin>, click **Demo login · owner** (or **barber** to see the limited role)

Starting from an empty Neon database? Create the demo data once:

```bash
pnpm db:migrate          # applies db/migrations/*.sql
pnpm db:seed             # demo shop, barbers, services (prices empty), clients, a filled demo day
pnpm demo:setup          # creates the two demo staff logins in Neon Auth and links their profiles
```

The admin calendar auto-fills the selected day with sample bookings in mock mode if it's empty. Demo logins are `DEMO_OWNER_EMAIL` / `DEMO_BARBER_EMAIL` with `DEMO_PASSWORD` from `.env.local`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js (port 3470) |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | tsc · ESLint · Vitest (availability engine, tokens, CSV mapping) |
| `pnpm demo` | Production build + start on port 3470 |
| `pnpm db:migrate` / `db:seed` / `demo:setup` | Schema, demo data, demo logins |
| `pnpm db:reset-demo` | Wipes the DEMO database's data and reloads the seed (refuses in live mode) |
| `pnpm db:check` | **36 checks against the real database**: a public-only role can't read or write private data, no double booking, hours / time-off / booking-window rules, reschedule, walk-in seating, rate limiter, live counters |
| `pnpm check:secrets` | After a build, proves no server secret is in the browser bundle |

## Mock mode vs live mode

`NEXT_PUBLIC_APP_MODE=mock|live` is the only switch. Everything that touches the outside world goes through one small adapter:

| Adapter | mock | live |
|---|---|---|
| `lib/notify` | renders the message, writes it to `notifications_log`, shown at `/admin/outbox` | Resend for email; SMS provider stub (not configured) |
| `lib/turnstile` | always passes, widget not rendered | Cloudflare Turnstile verification |
| Admin login | **Demo login** buttons + email/password | email/password only; the demo action refuses |
| `lib/payments` | stub, nothing is charged (pay at the shop) | same stub |
| Database | Neon demo project (demo seed) | your live Neon project (migrations only, never the seed) |

## Switching to live

1. **Neon project (live)**: create it in a Realtime region (`aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1` or `aws-ap-southeast-1`), **Postgres 18**, and turn on Auth and Realtime in the console (this also enables logical replication). Add your site's origin to Realtime's allowed origins.
2. Put `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_REALTIME_URL` (+ `NEXT_PUBLIC_NEON_REALTIME_URL`) and `NEON_REALTIME_SECRET` in Vercel, plus fresh `NEON_AUTH_COOKIE_SECRET`, `APP_TOKEN_SECRET`, `CRON_SECRET`.
3. `pnpm db:migrate` against it (**do not run `db:seed`** on live). Create the real shop row, hours, barbers and services (SQL or the admin).
4. **First owner**: create the user in Neon Auth (console > Auth > Users), then insert their profile: `insert into profiles (id, shop_id, role, display_name) values ('<neon auth user id>', '<shop id>', 'owner', 'Carlo S.');`. Add other staff the same way with role `barber`.
5. **Resend**: verified sending domain + API key. **Turnstile**: site + secret keys.
6. Deploy on Vercel (`vercel.json` registers the reminder cron every 15 min), set `NEXT_PUBLIC_APP_MODE=live`.

## Environment variables

Names only live in [`.env.example`](.env.example); values go in `.env.local` (git-ignored) or Vercel.

| Variable | Used for | Mock | Live |
|---|---|---|---|
| `NEXT_PUBLIC_APP_MODE` | `mock` or `live` | yes | yes |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails, metadata | yes | yes |
| `DATABASE_URL` | **Server only.** Neon owner connection (pooled). Bypasses RLS | demo project | **secret** |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | Staff sign-in (Managed Better Auth) and its cookie key (32+ chars) | yes | **secret** |
| `NEON_REALTIME_URL`, `NEXT_PUBLIC_NEON_REALTIME_URL` | Realtime endpoint (public, browsers connect to it) | yes | yes |
| `NEON_REALTIME_SECRET`, `NEON_REALTIME_DB` | **Server only.** Seals live queries; database name | yes | **secret** |
| `APP_TOKEN_SECRET` | 32+ chars. Signs booking and walk-in links | random | **secret** |
| `CRON_SECRET` | Protects `/api/cron/reminders` | random | **required** |
| `DEMO_OWNER_EMAIL`, `DEMO_BARBER_EMAIL`, `DEMO_PASSWORD` | Demo login buttons (mock only) | yes | ignored |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | Sending email | – | **required** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot check on booking and line forms | – | **required** |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM_NUMBER` | Text messages (provider not chosen; see TODO-LIVE) | – | optional |

Live mode refuses to send if the required ones are missing, with a message naming them.

## Security model (short version)

- **One database client, server only.** `src/lib/db.ts` uses the owner connection string, which never reaches the browser (ESLint blocks importing it from components; `pnpm check:secrets` scans the built bundle). All SQL is parameterised.
- **Authorisation is in code, then enforced by data scoping:** every admin action calls `authorize()` (role from the `profiles` table via the Neon Auth session) and scopes queries to the staff member's `shop_id`. The admin layout re-checks on every page.
- **RLS is on for every table that holds private data, with no policies (deny all),** so any other connection (a Data API, an analyst role) sees nothing. A `public_reader` role can read only public-safe tables and only published barbers / shown services. `pnpm db:check` proves it. `queue_state`, `busy_blocks` and `live_ticks` have no RLS because Neon Realtime can't live-query RLS tables; they hold no personal data by construction.
- **Realtime** only ever seals queries over `queue_state` and `live_ticks`, server-side, from a fixed list (`/api/live`); the staff ticker requires a staff session. No client input reaches the SQL.
- Booking and walk-in intake: honeypot → Zod → Turnstile → rate limit (IP + phone, Postgres-backed, fails closed) → database function that re-validates hours, time off and window, and relies on the exclusion constraint.
- Public links (confirm, cancel, reschedule, "your place in line") use HMAC-signed, expiring tokens, not IDs. Customer phone and email never reach public client code.
- Headers: CSP, HSTS, Referrer-Policy, X-Frame-Options, Permissions-Policy. Public pages use a static CSP (so they stay static/ISR); `/admin` uses a per-request nonce CSP.

## Project layout

```
src/app/(site)/      public pages     src/app/admin/     login + (app) screens
src/app/api/         availability, ICS, line status, sealed live queries, auth proxy, cron
src/components/      site/ and admin/ (client islands only where interactive)
src/lib/             db, env, availability engine, notify, tokens, ratelimit, schemas, csv, live
src/middleware.ts    /admin nonce CSP
db/                  migrations, seed.sql (demo data only), demo-profiles.sql
scripts/             db-apply.mjs, db-check.ts, setup-demo-users.ts, check-no-service-role-in-client.ts
```

## Performance

Public pages are static/ISR; only the wait card, booking wizard, line forms and tab bar are client code, and the Realtime client loads after the page is idle. Fonts via `next/font`, images via `next/image`, animations are transform/opacity only and switch off under `prefers-reduced-motion`. Measure on a production build: `pnpm build && pnpm start`, then `lighthouse http://localhost:3470 --form-factor=mobile`.
