# PLAN.md — Carlo's Barbershop (website + admin), round 1: clickable mock

Status: **draft, waiting for "go"**. Nothing has been scaffolded or committed yet.

---

## 0. What I found

| Thing | State |
|---|---|
| Working folder | `Carlos/` is **not a git repo**. It holds only `carlos-claude-code-starter-prompt.md` and `brand/carlos-logo.png` (1472×1425) + `brand/carlos-logo-web.png` (900×871). Greenfield. |
| GitHub repo `guraaseessethi/carlosbarbershop` | Returns **404** from here (private or not created) and `gh` is not logged in. I can't read it or push to it. |
| Design canvas | Read in full: `Main` (desktop client site), `Mobile` (same file, phone mode), `Admin` (Today / Clients / Services / Emails). Source of truth for look and copy. |
| Toolchain | Node 22.23, pnpm 10.14, Supabase CLI 2.72.7, gh 2.103, git 2.33 ✔. **Docker: not installed** ✘ (see Q1). |

### Facts the canvas already contains (I'll reuse them, and list them in `TODO-LIVE.md` to confirm)
- **Address / contact:** 331 Bayfield St, Barrie, ON L4M 3C2 · 705-721-4400 · Carlodabarber@gmail.com · Instagram `carlosbarbershop705` · Facebook `780497408713154`
- **Hours:** Mon–Fri 9:00–5:45 pm, Sat 9:00–4:00 pm, Sun closed
- **7 barbers:** Carlo S., Cosmo F., Linda, Estella, Mike, John F., Loretta M. (initials, no photos)
- **7 services:** Haircut · Haircut and beard trim · Seniors haircut 65+ · Kids haircut under 12 · Hot towel shave · Hot towel head shave · Beard trim (+ durations)
- **3 review quotes + "4.4 · 313 reviews"** and the claims "since 2015" / "Seniors and kids $30"
- **5 message templates** (confirmation, reminder day-before, reminder 2h, walk-in "you're next", and a "come back" nudge)

---

## 1. Questions / decisions I need from you (my default in bold — "go" accepts all of them)

1. **Docker (blocker for local Supabase).** `supabase start` needs a container runtime and none is installed. **Default: you install OrbStack (`brew install orbstack`) or Docker Desktop; I code against local Supabase and write the SQL tests so they run once it's up.** Until then I can build and type-check everything but can't run it end to end. Alternative: point mock mode at a free hosted Supabase dev project instead (works today, but isn't "local").
2. **Repo.** **I `git init` in this folder, commit in small steps, and don't push.** When you run `gh auth login` (or tell me the repo is ready/public) I'll add the remote. I won't push without you saying so.
3. **Prices.** The canvas shows real-looking prices ($35, $45, …); your prompt says `[PRICE]` placeholders. **Seed `price_cents = NULL`; the UI renders `[PRICE]`; admin can set real numbers; the "expected revenue" KPI shows "—" until prices exist.** (Switching to the canvas numbers is a one-line seed change.)
4. **Reviews.** **Seed the 3 quotes + 4.4/313 from your canvas, flagged "verify" in `TODO-LIVE.md`.** I won't write any new ones.
5. **Where I deviate from the canvas, to match your brief:**
   - Booking is its own `/book` page (canvas inlines it in Home). Keeps Home static and light.
   - Phone tab bar is **Home · Book · Line · Visit** (canvas had Menu/More).
   - Everything else (pole stripe, brass menu board, walk-in card, admin layout) follows the canvas.
6. **Texts (SMS).** Not in your stack. **`lib/notify` has an `sms` channel; mock mode logs to `/admin/outbox`; live mode has a Twilio-shaped stub that throws "not configured".** Provider choice goes in `TODO-LIVE.md`.
7. **CSP vs static pages.** Nonce-based CSP forces every page dynamic and kills ISR. **Public pages get a static CSP from `next.config` (`script-src 'self' 'unsafe-inline'` + Turnstile); `/admin/**` gets a strict per-request nonce CSP from middleware.** HSTS, Referrer-Policy, X-Frame-Options, Permissions-Policy on everything.
8. **Next.js 15 pinned** (16 is current) as instructed. Zod 4, React 19, Tailwind 4.

---

## 2. Architecture in one page

### Modes
`NEXT_PUBLIC_APP_MODE=mock|live`, parsed once in `lib/env.ts` (Zod; server and public schemas separate; fails fast with a readable message). Everything mode-dependent goes through adapters, so switching is config only:

| Adapter | mock | live |
|---|---|---|
| `lib/notify` (`send({channel, template, to, data})`) | render template → insert `notifications_log` (status `logged`) → shows in `/admin/outbox` | Resend (email) / SMS stub; log row status `sent`/`failed` |
| `lib/turnstile` | always passes (widget replaced by a dummy field) | Cloudflare siteverify |
| `lib/payments` | stub: `isEnabled() = false`, interface only | same stub (no payments this round) |
| `lib/auth` | "Demo login" server action signs in a seeded owner (guarded by `mode === 'mock'` server-side; the button isn't rendered in live) | magic link (`signInWithOtp`) |
| `lib/ratelimit` | Postgres-backed (below) in both modes | same |

### Rendering strategy (speed)
- **Static / ISR:** Home, Services, Barbers, Visit. Data via server components + `unstable_cache`/tags, revalidated when admin edits services/barbers/hours (`revalidateTag`).
- **Client islands only:** `LiveWaitCard`, `BookingWizard`, `JoinLineForm`, `LineStatus`, tab-bar active state, Turnstile (loaded on the last step only), admin interactive panels.
- Fonts via `next/font` (Playfair 700, Oswald 400/500/600, Inter variable, `display: swap`, subset latin). All images `next/image` with explicit `sizes`; logo is `priority` on Home only.
- Hero animation is CSS `transform`/`opacity` only (the canvas animates `background-position`, which isn't compositor-friendly; I'll switch it to a transformed pseudo-element). `prefers-reduced-motion` turns the pole/pillar/float/ticker animations off.
- No map iframe on Home (static address card with "Get directions"); the embed is lazy-loaded on `/visit` only.

### Realtime without leaking anything
Supabase Realtime `postgres_changes` honours RLS, but public users must never be able to read `bookings`/`walkins`. So the public never touches those tables. Instead:
- **`queue_state`** (one row per shop: `waiting_count`, `est_wait_min`, `updated_at`) — public-readable, realtime-enabled, maintained by a trigger on `walkins`, `barbers.on_duty` and in-chair bookings. No names, ever.
- **`busy_blocks`** (`barber_id`, `during tstzrange`) — public-readable, realtime-enabled, maintained by a trigger on `bookings` (booked/in_chair only; cancelled removes the row). No client data, no booking id.
- The booking wizard subscribes to `busy_blocks` and re-asks the server for availability when it changes; if your slot was just taken you get a friendly "someone just grabbed that, pick another".
- The "you're #3" page holds a **signed walk-in token**. It subscribes to `queue_state` as a "something changed" ping, then calls a route handler (`/api/line/[token]`) that verifies the token and returns only your position/ETA. Names and phones never reach the client.
- **Admin** (authenticated staff) subscribes directly to `bookings`, `walkins`, `barbers` — allowed by staff RLS. Seating a walk-in on the iPad updates every other screen instantly.

### No double booking (belt and braces)
1. Availability engine (`lib/availability`, pure TS, unit-tested): shop/barber `working_hours` − `time_off` − existing bookings − (min lead time) within the booking window, on a 30-min step (setting), in `America/Toronto`.
2. All booking creation goes through one Postgres function `create_booking(...)` (SECURITY DEFINER, executable by `service_role` only) that re-validates hours/time-off/window and inserts in one transaction.
3. **`EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('booked','in_chair'))`** (needs `btree_gist`). Two simultaneous requests → one gets `23P01`, which the server action maps to "slot taken". "First available" picks a free barber and retries on the next one on conflict.

### Security model
- **RLS enabled + forced on every table.** Helper functions `private.is_staff()` / `private.is_owner()` (SECURITY DEFINER, read `profiles`, no recursion).
- Public (anon) can `SELECT` only: published `services`, published `barbers`, `barber_services` for those, `working_hours`, `shops` public columns, `queue_state`, `busy_blocks`. **Nothing else, no writes, no direct inserts.**
- Public intake (booking, walk-in, cancel/reschedule via token) is a **Server Action**: Zod-parse → honeypot → Turnstile → rate limit (IP + phone) → service-role client (`server-only` module, never imported by client code; lint rule + a build-time grep check) → RPC.
- Admin: middleware gate on `/admin/**` (session + role in `profiles`), **plus** `requireRole(['owner','barber'])` at the top of every admin server action/route handler. Owner-only: settings, barbers, services, messages, CSV import, delete.
- Rate limiting: table `rate_limits(key, window_start, hits)` + function `hit_rate_limit(key, window_seconds, max)` (atomic upsert; service-role only; no policies = deny-all for others). Works on serverless, no extra service. Keys: `booking:ip:<ip>`, `booking:phone:<e164>`, same for walk-ins.
- Signed tokens (`lib/tokens`): HMAC-SHA256 over `{kind, id, exp}` with `APP_TOKEN_SECRET`, base64url, `timingSafeEqual`. Used for booking confirm/cancel/reschedule links and the walk-in status page. Not guessable, not enumerable, expire.
- Parameterised queries only (supabase-js / RPC; the few raw SQL bits live in migrations).
- Phone/email are never selected into any public response. Public types don't even have those fields.
- Secrets only in `.env.local` (git-ignored). `.env.example` has names, no values. `NEXT_PUBLIC_*` limited to URL, anon key, mode, Turnstile site key, site URL.

---

## 3. File structure

```
carlos/
├─ PLAN.md  README.md  TODO-LIVE.md  CLAUDE.md  .env.example
├─ docs/starter-prompt.md                    # your original brief, moved here
├─ package.json  pnpm-lock.yaml  tsconfig.json (strict)  next.config.ts
├─ eslint.config.mjs  postcss.config.mjs  vitest.config.ts
├─ middleware.ts                              # /admin gate + admin CSP nonce
├─ public/brand/carlos-logo.png  carlos-logo-web.png
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  │  ├─ 0001_schema.sql        # tables, enums, constraints, indexes
│  │  ├─ 0002_functions.sql     # create_booking, queue/busy triggers, rate limit, helpers
│  │  ├─ 0003_rls.sql           # enable+force RLS, policies, grants/revokes
│  │  └─ 0004_realtime.sql      # publication for queue_state, busy_blocks, bookings, walkins, barbers
│  ├─ seed.sql                   # shop, 7 barbers, services (NULL prices), hours, demo clients/bookings/queue, demo owner
│  └─ tests/                     # pgTAP: rls_anon.test.sql, rls_staff.test.sql, overlap.test.sql
├─ scripts/
│  ├─ rls-check.ts               # anon-key script proving no read of clients/bookings/walkins (+ writes denied)
│  ├─ print-local-env.sh         # prints the local-only Supabase keys to paste into .env.local
│  └─ check-no-service-role-in-client.ts
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx  globals.css (Tailwind v4 @theme tokens)  not-found.tsx
│  │  ├─ (site)/
│  │  │  ├─ layout.tsx          # nav, footer, mobile tab bar
│  │  │  ├─ page.tsx            # Home (ISR)
│  │  │  ├─ services/page.tsx   barbers/page.tsx   visit/page.tsx
│  │  │  ├─ book/page.tsx  book/actions.ts
│  │  │  ├─ book/confirmed/[token]/page.tsx      # confirmation + add-to-calendar (.ics route) 
│  │  │  ├─ b/[token]/page.tsx  b/[token]/actions.ts   # manage: cancel / reschedule
│  │  │  ├─ line/page.tsx  line/actions.ts
│  │  │  └─ line/[token]/page.tsx                # live position page
│  │  ├─ api/
│  │  │  ├─ line/[token]/route.ts      # position/ETA for a token
│  │  │  ├─ availability/route.ts      # slots for service+barber+day (public-safe)
│  │  │  ├─ calendar/[token]/route.ts  # .ics
│  │  │  └─ cron/reminders/route.ts    # Vercel Cron, CRON_SECRET-gated
│  │  └─ admin/
│  │     ├─ login/page.tsx  login/actions.ts    # magic link (live) / demo login (mock)
│  │     ├─ (app)/layout.tsx                    # sidebar shell, role check
│  │     ├─ (app)/page.tsx                      # Today
│  │     ├─ (app)/queue/page.tsx
│  │     ├─ (app)/clients/page.tsx  clients/[id]/page.tsx  clients/import/page.tsx
│  │     ├─ (app)/services/page.tsx  barbers/page.tsx  messages/page.tsx  settings/page.tsx
│  │     └─ (app)/outbox/page.tsx               # mock-mode dev log of emails/texts
│  ├─ components/
│  │  ├─ ui/            # Button, Field, Switch(Radix), Dialog/Sheet(Radix), Toast, PoleStripe, MenuBoard, Kicker
│  │  ├─ site/          # Hero, LiveWaitCard(client), BookingWizard(client), JoinLineForm(client), LineStatus(client), TabBar(client), ReviewQuotes, HoursCard
│  │  └─ admin/         # Sidebar, DayCalendar(client), BookingPanel(client), QueueList(client), DutyToggle(client), CsvImporter(client), TemplatePreview
│  ├─ lib/
│  │  ├─ env.ts  mode.ts
│  │  ├─ supabase/ server.ts  browser.ts  admin.ts(server-only)  middleware.ts  types.ts(generated)
│  │  ├─ availability/  index.ts  slots.ts  tz.ts  *.test.ts
│  │  ├─ notify/  index.ts  mock.ts  resend.ts  sms.ts  templates/*.tsx (React Email)
│  │  ├─ payments/  index.ts (stub)
│  │  ├─ turnstile.ts  ratelimit.ts  tokens.ts  honeypot.ts  csrf-origin.ts
│  │  ├─ auth/  requireRole.ts  demo.ts
│  │  ├─ queue/  estimate.ts (+test)
│  │  ├─ csv/  parse.ts  mapping.ts  (+tests)
│  │  ├─ schemas/  booking.ts  walkin.ts  service.ts  barber.ts  client.ts  settings.ts  (Zod)
│  │  └─ format.ts (money w/ [PRICE], dates, phone → E.164)
│  └─ content/site.ts   # address, phone, socials, review quotes (flagged verify)
```

---

## 4. Data model (refined from your starting point)

Enums: `app_role (owner, barber)`, `booking_status (booked, in_chair, done, no_show, cancelled)`, `booking_source (web, admin, walk_in)`, `walkin_status (waiting, seated, removed, left)`, `notify_channel (email, sms)`, `notify_status (logged, sent, failed)`.

| Table | Key columns / notes |
|---|---|
| `shops` | id, name, address, phone, public_email, timezone (`America/Toronto`), booking_window_days, min_lead_minutes, slot_step_minutes, avg_walkin_minutes. Single row now, `shop_id` everywhere so multi-shop isn't a rewrite. |
| `profiles` | id (= `auth.users.id`), shop_id, role, display_name, barber_id nullable |
| `barbers` | id, shop_id, name, initials, bio, photo_path (Storage, nullable), is_published, **on_duty** (live toggle), sort_order |
| `services` | id, shop_id, name, **price_cents NULL**, duration_minutes, description, show_online, sort_order |
| `barber_services` | barber_id, service_id (who does what) |
| `working_hours` | shop_id, barber_id NULL (= shop hours), weekday 0–6, opens, closes (local time). Barber hours must sit inside shop hours. |
| `time_off` | barber_id, starts_at, ends_at, reason (staff-only) |
| `clients` | id, shop_id, name, phone (E.164, unique per shop), email, notes, marketing_ok, created_at, source (web/import/walk_in) |
| `bookings` | id, shop_id, barber_id, service_id, client_id, starts_at, ends_at, status, source, price_cents_snapshot, notes, cancelled_at, **EXCLUDE overlap constraint** |
| `walkins` | id, shop_id, client_id NULL, display_name, phone, service_id NULL, status, joined_at, seated_at, seated_barber_id, notified_next_at, token_nonce. Position is derived from `joined_at` among `waiting` rows (no stored position to drift; the `position` the brief mentions is a view/function). |
| `queue_state` | shop_id PK, waiting_count, est_wait_min, updated_at — public, trigger-maintained |
| `busy_blocks` | id, barber_id, during tstzrange — public, trigger-maintained, no PII |
| `message_settings` | shop_id, template_key, email_enabled, sms_enabled (confirmation, reminder_24h, reminder_2h, walkin_next, come_back) |
| `notifications_log` | id, template_key, channel, to_address, subject, body, status, provider_id, booking_id/walkin_id, created_at — staff-only |
| `rate_limits` | key, window_start, hits — no policies (deny-all), service role only |

Seed: one shop, 7 barbers (Mike marked off-duty like the canvas), 7 services (`NULL` price), the hours above, ~12 demo clients with history, a day of demo bookings across barbers, 4 waiting walk-ins, 5 message templates enabled per the canvas, and one seeded **demo owner** auth user (local only).

### RLS summary

| Table | anon | staff (owner/barber) | owner only |
|---|---|---|---|
| shops (public cols) , barbers (published), services (show_online), barber_services, working_hours | select | select all | write |
| time_off | – | select/write | delete |
| clients, bookings, walkins | **none** | select/insert/update | delete |
| queue_state, busy_blocks | select | select | – (trigger-only writes) |
| message_settings | – | select | update |
| notifications_log | – | select | – (service role inserts) |
| profiles | – | own row | all |
| rate_limits | – | – | – |

---

## 5. Build order (each step = 1–3 small commits; I stop to show you at ★)

0. **Scaffold** — `git init`, Next 15 + TS strict + Tailwind v4 + ESLint + Vitest, Radix deps, `.gitignore`, `.env.example`, `CLAUDE.md`, move logo to `public/brand/`, move brief to `docs/`. `pnpm build` green.
1. **Database** — migrations 0001–0004, `seed.sql`, generated types, pgTAP tests, `scripts/rls-check.ts`. *(Needs Docker, see Q1.)*
2. **Core libs** — `env`, Supabase clients, tokens, ratelimit, honeypot/turnstile, `notify` (mock + Resend), availability engine, queue estimate, Zod schemas. Unit tests.
3. **Design system + site shell** — tokens in CSS variables, fonts, pole stripe, buttons, menu-board, nav, footer, mobile tab bar. ★ visual check against canvas.
4. **Home** (ISR) + `LiveWaitCard` realtime island; Services, Barbers, Visit pages.
5. **Booking** — wizard, availability API + realtime, `create_booking` action, confirmation page, `.ics`, cancel/reschedule via signed token.
6. **Walk-in line** — join action, live position page, `queue_state` realtime.
7. **Admin foundation** — middleware, `requireRole`, login (demo + magic link), shell, `/admin/outbox`. ★
8. **Admin Today** — per-barber columns, on/off-duty toggles, booking side panel (in chair / done / no-show / send reminder), realtime.
9. **Admin Walk-in queue** — live list, "Seat with [barber]", remove; cross-window realtime verified.
10. **Admin Clients** — search, detail with visit history, CSV import with column-mapping preview.
11. **Admin Services, Barbers, Messages, Settings** — edits revalidate public pages; template previews rendered with the same React Email components.
12. **Emails + reminders** — React Email templates, reminder cron route, walk-in "you're up next" trigger.
13. **Hardening** — security headers, admin nonce CSP, abuse-path tests (rate limit, honeypot, bad token, double-book race).
14. **Perf + a11y pass** — Lighthouse mobile ≥95 on Home, CLS 0, reduced-motion, keyboard/focus, contrast.
15. **Docs + final verification** — `README.md`, `TODO-LIVE.md`, full run-through ★.

---

## 6. How I'll prove "done" (maps to your checklist)

| Your requirement | Proof |
|---|---|
| `pnpm dev` works on seeded data, every screen clickable on desktop + phone | Walk every route in the browser pane at desktop and 390px |
| Realtime across two windows | Two browser tabs: join line on tab A → admin queue + public card update on tab B; seat on tab B → gone from tab A; duty toggle → booking availability changes |
| No double booking | pgTAP overlap test + a two-request race test on `create_booking` |
| RLS proof | `supabase test db` (pgTAP) **and** `scripts/rls-check.ts` using the anon key: reads of `clients`/`bookings`/`walkins`/`time_off`/`notifications_log` return nothing/denied, writes denied, `queue_state`/`services` readable |
| `pnpm build` clean, no type errors | CI-style `pnpm typecheck && pnpm lint && pnpm test && pnpm build` |
| Lighthouse mobile ≥95 on Home | Lighthouse CLI against `pnpm build && pnpm start`, numbers pasted into README |
| README + TODO-LIVE | Written last, every env var listed |

Env vars (full table goes in README): `NEXT_PUBLIC_APP_MODE`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_TOKEN_SECRET`, `DEMO_OWNER_EMAIL`/`DEMO_OWNER_PASSWORD` (mock only), `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, (SMS stub) `SMS_PROVIDER`, `SMS_API_KEY`.

---

## 7. Not in this round
Real payments (stub only), real SMS provider, barber photos, importing the real client export (importer is built and tested on a sample CSV), multi-shop UI, customer accounts/login, Google Business review sync, domain/DNS.
