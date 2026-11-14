# TODO-LIVE: what's still needed to go live

Everything in the app works on seeded data. This is the exact list of what to plug in. Nothing here needs code changes unless noted.

## 1. Content only the owner can supply

- [ ] **Real prices** for all 7 services. Admin → Services & prices (until set, the site shows `[PRICE]`). The seed has `NULL` prices on purpose.
- [ ] **Confirm the facts taken from the design canvas** (edit in `src/content/site.ts` and Admin → Settings):
  - Address `331 Bayfield St, Barrie, ON L4M 3C2`, phone `705-721-4400`, email `Carlodabarber@gmail.com`
  - Hours: Mon–Fri 9 am to 5:45 pm, Sat 9 am to 4 pm, Sun closed
  - "Since 2015" (hero and ticker)
  - Instagram `carlosbarbershop705` and Facebook page link
  - The seven barber names and which services each does
  - Service names and time estimates ("15 to 20 min", etc.)
- [ ] **Real Google review quotes** + attribution. The three quotes and "4.4 · 313 reviews" on the site came from the canvas; please verify the wording and the live rating (`src/content/site.ts`). No reviews were invented.
- [ ] **Barber photos** (and a one-line bio each). Initials show until then. *Needs a code step: add file storage (Neon has storage buckets, or Vercel Blob) and wire `barbers.photo_path` into `BarberGrid` and the admin Barbers form with `next/image`.*
- [ ] **Client CSV** from the current booking system. Admin → Clients → Import CSV (mapping preview built; tested on a sample). Existing phone/email matches are skipped, never overwritten.
- [ ] **"Come back" message** (4 weeks after a visit): the template and toggle exist, but sending is **not wired** because it needs marketing consent (`clients.marketing_ok`) and a consent flow. Decide whether to offer it.

## 2. Accounts and keys (add by hand; never commit)

- [ ] **Domain** (e.g. `carlosbarbershop.net`): point DNS at Vercel; set `NEXT_PUBLIC_SITE_URL` to it.
- [ ] **Neon project for LIVE** (the current Neon project, `carlosbarbershop-demo`, is demo data): create it in a Realtime region on **Postgres 18**, enable Auth and Realtime (this turns on logical replication), add your domain to Realtime's allowed origins, then set `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_REALTIME_URL`, `NEXT_PUBLIC_NEON_REALTIME_URL`, `NEON_REALTIME_SECRET`. Run `pnpm db:migrate` (migrations only, **never `db:seed`**). Neon Realtime is in beta: check its status before launch.
- [ ] **Create the real shop + first owner** (see README, Switching to live, step 4), then add the other staff the same way (role `barber`). Consider turning off open sign-up in Neon Auth (a sign-up without a `profiles` row has no access, but there's no reason to allow it).
- [ ] **Resend**: API key (`RESEND_API_KEY`), verified sending domain, `NOTIFY_FROM_EMAIL` (e.g. `Carlo's <bookings@carlosbarbershop.net>`). SPF/DKIM/DMARC records for that domain.
- [ ] **Cloudflare Turnstile**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for the domain.
- [ ] **Secrets**: generate fresh `APP_TOKEN_SECRET` (`openssl rand -base64 48`) and `CRON_SECRET` for production. Changing `APP_TOKEN_SECRET` invalidates all existing booking links.
- [ ] **Vercel**: add env vars, deploy, confirm the cron in `vercel.json` is accepted on your plan (every 15 min), then set `NEXT_PUBLIC_APP_MODE=live`.

## 3. Decisions still open

- [ ] **Text messages (SMS) provider.** Not in the agreed stack. `lib/notify/sms.ts` is a stub that logs "SMS provider not configured". Pick a provider (e.g. Twilio, needs a Canadian number and CASL-compliant consent wording), then implement `sendSms` and set `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM_NUMBER`. Until then the "you're next" walk-in alert only appears in the outbox / does not reach phones.
- [ ] **Payments.** Stubbed (`lib/payments`); the shop is pay-at-the-chair. Add deposits only if wanted.
- [ ] **Privacy policy + terms** pages and cookie wording (the site sets no tracking cookies; the admin sets the Neon Auth session cookie). Add links in the footer before launch.
- [ ] **Analytics** (none installed).
- [ ] **Google Business link** to the booking page, and the `Google review` links.

## 4. Before launch checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- [ ] `pnpm db:check` against a scratch copy of the schema (it creates and removes its own test rows; don't run it on the live database)
- [ ] Place a real booking, a cancel and a reschedule end to end; confirm the email arrives and the link works
- [ ] Join the walk-in line from a phone and seat it from the shop iPad; confirm both screens update
- [ ] Lighthouse mobile on the production URL (Home ≥ 95)
- [ ] Make sure the demo staff logins (`owner@carlos.test`, `barber@carlos.test`) do NOT exist in the live Neon Auth project
