# Carlo's Barbershop

Next.js 15 (App Router, RSC by default) + Supabase + Tailwind v4. pnpm only. Plan: PLAN.md.

## Rules
- TypeScript strict. Zod-validate every form and every server action input.
- Mutations are Server Actions. Public intake runs with the service role **on the server only** (`src/lib/supabase/admin.ts`, `server-only`). Never import it from `src/components/**` (eslint blocks it).
- Every admin action starts with `requireRole()`. Middleware is not enough.
- Customer phone/email never reach public client code. Public reads use `queue_state` / `busy_blocks`, never `bookings`/`walkins`.
- All external calls go through adapters: `lib/notify`, `lib/turnstile`, `lib/payments`, `lib/auth`. Mode = `NEXT_PUBLIC_APP_MODE`.
- Client components only for interactive islands. Keep public pages static/ISR.
- Design tokens are CSS variables in `src/app/globals.css`. Honour `prefers-reduced-motion`.
- Never invent reviews, prices or barber bios. Use placeholders; list them in TODO-LIVE.md.
- Secrets live in `.env.local` (user adds by hand). Only names in `.env.example`.

## Commands
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm db:start|reset|test|types` · `pnpm rls:check`
