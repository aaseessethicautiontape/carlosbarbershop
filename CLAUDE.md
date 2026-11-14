# Carlo's Barbershop

Next.js 15 (App Router, RSC by default) + Neon (Postgres, Managed Better Auth, Realtime) + Tailwind v4. pnpm only. Plan: PLAN.md (see its Neon update).

## Rules
- TypeScript strict. Zod-validate every form and every server action input.
- Mutations are Server Actions. The ONLY database client is `src/lib/db.ts` (`server-only`, owner connection, bypasses RLS). Never import it from `src/components/**` (eslint blocks it). Parameterised SQL only ($1, $2), never string-built.
- Every admin action starts with `authorize()` and scopes queries to the staff member's `shop_id`. That check is the real gate.
- Customer phone/email never reach public client code. Realtime only ever seals queries over `queue_state` and `live_ticks` (no PII; Neon Realtime can't live-query RLS tables).
- All external calls go through adapters: `lib/notify`, `lib/turnstile`, `lib/payments`, `lib/auth`. Mode = `NEXT_PUBLIC_APP_MODE`.
- Client components only for interactive islands. Keep public pages static/ISR.
- Design tokens are CSS variables in `src/app/globals.css`. Honour `prefers-reduced-motion`.
- Never invent reviews, prices or barber bios. Use placeholders; list them in TODO-LIVE.md.
- Secrets live in `.env.local` (user adds by hand). Only names in `.env.example`.

## Commands
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm db:migrate|db:seed|db:check` · `pnpm demo:setup` · `pnpm check:secrets`
