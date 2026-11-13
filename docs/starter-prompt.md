# Carlo's Barbershop: Claude Code starter prompt

Repo: https://github.com/guraaseessethi/carlosbarbershop
Design concept (Kooht canvas): https://claude.ai/artifact/9jTG4ijMwBhSsv8gSsYh5s

---

You're building the first version of a new website and admin for **Carlo's Barbershop** in Barrie, Ontario (current site: carlosbarbershop.net). This round is a **clickable mock** I can show the owner. Every screen should look finished and work end to end on seeded data. But build it on the real architecture from day one, so later I only plug in real keys and real data. No throwaway code.

Work in this repo. Start by reading what's already there. Then write `PLAN.md` with the file structure, the data model and the build order, and wait for me to say go.

## Stack (don't swap these)

- **Next.js 15**, App Router, TypeScript strict, React Server Components by default, Server Actions for mutations.
- **Tailwind CSS v4**. Design tokens go in CSS variables. No component library except headless primitives (Radix) where you need accessibility.
- **Supabase** for Postgres, Auth, Realtime and Storage. Use `@supabase/ssr`.
- **Zod** to validate every form and every server action input.
- **Resend + React Email** for emails. Behind a flag, so mock mode just logs them.
- **Vercel** to deploy.
- **pnpm**.

## Mock mode vs real mode

- Use `NEXT_PUBLIC_APP_MODE=mock|live`.
- **Mock:**
  - Use a local Supabase (`supabase start`) with `supabase/seed.sql`.
  - Emails and texts go to a dev log page at `/admin/outbox`.
  - The admin has a "demo login" button.
- **Live:** real Supabase project, real Resend, real admin auth (magic link). No demo button.
- Put every external call behind one small adapter (`lib/notify`, `lib/payments` stub) so switching modes is just config.

## Security (non-negotiable)

- **Row Level Security** on every table.
  - Public users can only read published services, barbers, hours and walk-in queue *counts*.
  - Public users can insert a booking or a walk-in entry only through a server action that validates with Zod and runs with the service role on the server.
- Never expose the service role key to the client. Secrets go in `.env.local` only, and I add them by hand. Commit a `.env.example` with names and no values.
- Admin routes are protected in middleware and re-checked in each server action (role = `owner` or `barber`).
- Abuse protection:
  - Rate limit booking and walk-in endpoints by IP and phone.
  - Add a honeypot field.
  - Use Cloudflare Turnstile, stubbed in mock mode.
- Set security headers in `next.config` (CSP, HSTS, Referrer-Policy, X-Frame-Options), and use parameterized queries only.
- Customer phone and email are never sent to the public client.

## Speed

- Aim for Lighthouse 95+ on mobile for the homepage.
- Use `next/font` for fonts and `next/image` for every image, with AVIF/WebP and correct `sizes`.
- No layout shift. Keep client JS minimal: only interactive islands are client components.
- Make static pages static (ISR). Make the booking and queue widgets small client islands.

## Realtime (this is the pitch)

Reviews complain about walk-in wait times, so the live line is the hero feature.

- **Live walk-in line:**
  - The public site shows how many people are waiting and an estimated wait. It updates live through Supabase Realtime and never shows names.
  - A customer can join the line from their phone and gets a live "you're #3" status page.
- **Admin:** the today calendar, the walk-in queue and the barber on/off duty toggles all update live across devices. If one barber seats a walk-in on the shop iPad, it's gone from everyone's screen instantly.
- **Booking availability:** this updates live too, so two people can't grab the same slot. Enforce it with a DB constraint as well (exclusion constraint on barber + time range), not only in the UI.

## Brand and design

Match the concept canvas. If you can't open the link, follow this:

- **Colours:**
  - barber-pole red `#B3222B`
  - navy `#1F3A68`
  - brass `#C9A35B`
  - ink `#121010`
  - warm off-white for backgrounds
- **Fonts:** Playfair Display (headlines), Oswald (labels, menu board, numbers), Inter (body).
- **Feel:** classic barbershop meets modern. Subtle barber-pole stripe accents, a brass menu-board look for prices, confident big type, smooth small animations (respect `prefers-reduced-motion`).
- **Logo:** I'll drop it at `public/brand/carlos-logo.png`.
- On phones it should feel like an app, with a fixed bottom tab bar (Home, Book, Line, Visit).

## Client site pages

1. **Home:**
   - The hero has the logo, a "Book a chair" button and a "Join the line" button, plus the live wait-time card.
   - Then the services menu board, the barbers, real Google review quotes (I'll paste them; don't invent any), hours and location.
2. **Book (4 steps):** service, then barber (or "first available"), then date and time from real availability, then name, phone and email, then confirm. Afterwards, a confirmation page with add-to-calendar, cancel and reschedule links. Each link uses a signed token, not a guessable ID.
3. **Line:** join the walk-in line, then a live position page.
4. **Services:** the full price list, editable from admin.
5. **Barbers:** seven barbers, using initials until I get photos.
6. **Visit:** hours, map embed and contact.

Prices: use `[PRICE]` placeholders in the seed. I'll fill in the real ones.

## Admin (`/admin`)

- **Today:**
  - A calendar with one column per barber and on/off duty toggles.
  - Click a booking to open a side panel with in chair, done, no-show and send reminder.
- **Walk-in queue:** a live list with "Seat with [barber]" and remove.
- **Clients:** search, a client detail page with visit history, and an "Import CSV" button (build the importer with a column-mapping preview; I'll export from their current system later).
- **Services:** edit name, price and duration, plus a "show online" switch.
- **Barbers:** add or edit, working hours, days off.
- **Messages:**
  - Toggles for booking confirmation, reminder (24h and 2h) and walk-in "you're up next" texts and emails.
  - A preview of each template.
- **Settings:** shop hours and the booking window.

## Data model (starting point; refine it in PLAN.md)

`shops`, `barbers`, `services`, `barber_services`, `working_hours`, `time_off`, `clients`, `bookings` (status enum), `walkins` (status enum, position), `notifications_log`, `profiles` (role).

## Definition of done for this round

- `pnpm dev` runs with seeded data, and I can click through every client and admin screen on desktop and phone.
- Realtime works across two browser windows.
- RLS is tested with a few SQL tests or a script that proves an anonymous user can't read clients or bookings.
- `pnpm build` passes with no type errors, and Lighthouse mobile is 95+ on Home.
- `README.md` explains how to run mock mode, how to switch to live, and every env var.
- `TODO-LIVE.md` lists exactly what I still need to plug in: real prices, real reviews, barber photos, client CSV, domain, Supabase project, Resend key, Turnstile key.

Commit in small, clear steps.
