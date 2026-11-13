# Carlo's Barbershop: website + admin

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres, Auth, Realtime, Storage) · Zod · Resend + React Email · pnpm.

This round is a **clickable mock** built on the real architecture. Everything works end to end on seeded data; going live is configuration plus the items in [`TODO-LIVE.md`](TODO-LIVE.md). The plan and the reasoning behind decisions are in [`PLAN.md`](PLAN.md).

## What's in it

| Public site | Admin (`/admin`) |
|---|---|
| Home with the **live walk-in wait** card, menu board, barbers, reviews, hours | **Today**: one column per barber, on/off-duty toggles, click a booking for in chair / done / no-show / send reminder |
| `/book`: four-step booking from real, live availability | **Walk-in line**: live list, "Seat" in a chair, remove, add by name |
| Confirmation page, add-to-calendar (.ics), cancel + reschedule by signed link | **Clients**: search, detail with visit history, **CSV import** with column-mapping preview |
| `/line`: join the walk-in line, then a live "You're #3" page | **Services & prices** (incl. "show online"), **Barbers** (hours, days off, services), **Emails & texts** (toggles + previews), **Settings** (shop hours, booking window) |
| `/services`, `/barbers`, `/visit` | **Outbox** (mock mode): every email/text the app would send |

Realtime: seat a walk-in on one screen and it disappears from every other admin screen; the public wait card and a customer's "#3" page update at the same moment. Two people can't take the same slot (database exclusion constraint, not just the UI).

## Quick start (mock mode)

Prerequisites: Node 20+, pnpm, Docker (Docker Desktop, OrbStack or Colima), the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
pnpm install
pnpm db:start                                  # local Supabase in Docker, applies migrations + seed.sql
./scripts/print-local-env.sh > .env.local      # local-only keys + random app secrets, mock mode
pnpm dev                                       # http://localhost:3470
```

- Public site: <http://localhost:3470>
- Admin: <http://localhost:3470/admin>, click **Demo login · owner** (or **barber** to see the limited role)
- Local inbox for Supabase Auth emails: <http://127.0.0.1:55324>
- Local Supabase Studio: <http://127.0.0.1:55323>

Ports are deliberately unusual (`3470`, `553xx`) so they don't collide with other projects. Change them in `package.json` and `supabase/config.toml`.

Reset the database any time with `pnpm db:reset`. In mock mode the admin calendar auto-fills the selected day with sample bookings if it's empty.

Seeded demo logins (local only): `owner@carlos.test` and `barber@carlos.test`, password `demo-pass-123`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | tsc · ESLint · Vitest (availability engine, tokens, CSV mapping) |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase lifecycle |
| `pnpm db:test` | pgTAP: RLS for anon/barber/owner, no double booking, hours/time-off rules, walk-in seating, rate limiter (78 assertions) |
| `pnpm rls:check` | Hits the REST API **with the anon key** and proves private tables can't be read or written (27 checks) |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` |

## Mock mode vs live mode

`NEXT_PUBLIC_APP_MODE=mock|live` is the only switch. Everything that touches the outside world goes through one small adapter:

| Adapter | mock | live |
|---|---|---|
| `lib/notify` | renders the message, writes it to `notifications_log`, shown at `/admin/outbox` | Resend for email; SMS provider stub (not configured) |
| `lib/turnstile` | always passes, widget not rendered | Cloudflare Turnstile verification |
| Admin login | **Demo login** buttons + magic link | magic link only; the demo action refuses |
| `lib/payments` | stub, nothing is charged (pay at the shop) | same stub |
| Database | local Supabase | your Supabase project |

## Switching to live

1. **Supabase project**: create one, then `supabase link --project-ref <ref>` and `supabase db push` (runs `supabase/migrations/*` only; **never push `seed.sql`**). In Auth settings, disable public sign-ups, set the Site URL, and add `https://<your-domain>/admin/auth/callback` as a redirect URL.
2. **First owner**: create the user in Supabase Auth (Dashboard → Authentication → Add user, email only), then in the SQL editor create the shop and profile, for example `insert into profiles (id, shop_id, role, display_name) values ('<auth user id>', '<shop id>', 'owner', 'Carlo S.');`. Add the real hours, barbers and services through the admin.
3. **Resend**: verify the sending domain, create an API key.
4. **Turnstile**: create a widget for your domain.
5. **Vercel**: import the repo, set the env vars below (Production), deploy. `vercel.json` registers the reminder cron (every 15 min; check your plan allows it, or point any scheduler at `/api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`).
6. Set `NEXT_PUBLIC_APP_MODE=live`.

## Environment variables

Names only live in [`.env.example`](.env.example); values go in `.env.local` (git-ignored) or Vercel.

| Variable | Used for | Mock | Live |
|---|---|---|---|
| `NEXT_PUBLIC_APP_MODE` | `mock` or `live` | yes | yes |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails, auth redirects, metadata | yes | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | local | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Safe in the browser; RLS protects data | local | project key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS; used for public intake after Zod validation | local | **secret** |
| `APP_TOKEN_SECRET` | 32+ chars. Signs booking and walk-in links | random | **secret** |
| `CRON_SECRET` | Protects `/api/cron/reminders` | random | **required** |
| `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD` | Local demo account hints (mock only) | optional | ignored |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | Sending email | – | **required** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Bot check on booking and line forms | – | **required** |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM_NUMBER` | Text messages (provider not chosen; see TODO-LIVE) | – | optional |

Live mode refuses to send if the required ones are missing, with a message naming them.

## Security model (short version)

- **RLS is enabled and forced on every table.** Anonymous visitors can read only: the shop, published barbers, shown services, working hours, and two name-free mirror tables (`queue_state`, `busy_blocks`). Nothing else, and no writes.
- Booking and walk-in intake are **Server Actions**: honeypot → Zod → Turnstile → rate limit (IP + phone, Postgres-backed, fails closed) → service-role RPC. The service-role client is `server-only` and ESLint blocks it from `src/components`.
- Admin: middleware gate + role re-check in the layout and at the top of **every** server action. Owner-only actions are enforced again by RLS and a database trigger.
- Public-facing links (confirm, cancel, reschedule, "your place in line") use HMAC-signed, expiring tokens, not IDs.
- Customer phone and email never reach public client code.
- Headers: CSP, HSTS, Referrer-Policy, X-Frame-Options, Permissions-Policy. Public pages use a static CSP (so they stay static/ISR); `/admin` uses a per-request nonce CSP.

Run the proofs: `pnpm db:test` and `pnpm rls:check`.

## Project layout

```
src/app/(site)/      public pages     src/app/admin/     login + (app) screens
src/app/api/         availability, ICS, line status, cron
src/components/      site/ and admin/ (client islands only where interactive)
src/lib/             env, supabase clients, availability engine, notify, tokens, ratelimit, schemas, csv
src/middleware.ts    /admin gate + nonce CSP
supabase/            migrations, seed.sql, pgTAP tests
scripts/             rls-check.ts, print-local-env.sh
```

## Performance

Public pages are static/ISR; only the wait card, booking wizard, line forms and tab bar are client code, and the Realtime client loads after the page is idle. Fonts via `next/font`, images via `next/image`, animations are transform/opacity only and switch off under `prefers-reduced-motion`.

Measure on a production build: `pnpm build && pnpm start`, then `lighthouse http://localhost:3470 --form-factor=mobile`.
