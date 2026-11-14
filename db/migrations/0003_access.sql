-- Access model on Neon.
-- The app is the ONLY database client: Next.js server code connects with the owner role (DATABASE_URL, a
-- server secret), after checking the user's role itself. Defence in depth for anything that connects any other way
-- (a future Data API, a read-only analyst role):
--   * RLS is ON for every table that holds personal or private data, with NO policies = deny all;
--   * a `public_reader` role can read only the public-safe tables (and only published barbers / shown services).
-- queue_state, busy_blocks and live_ticks have no RLS because Neon Realtime cannot live-query RLS tables;
-- they contain no personal data by construction.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'public_reader') then create role public_reader nologin; end if;
end $$;

-- Lets the owner role SET ROLE public_reader (used by scripts/db-check.ts to prove what the public role can and can't do).
grant public_reader to current_user with set true, inherit false;

alter table public.profiles enable row level security;
alter table public.time_off enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.walkins enable row level security;
alter table public.message_settings enable row level security;
alter table public.notifications_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.shops enable row level security;
alter table public.barber_services enable row level security;
alter table public.working_hours enable row level security;

create policy shops_public_read on public.shops for select to public_reader using (true);
create policy barbers_public_read on public.barbers for select to public_reader using (is_published);
create policy services_public_read on public.services for select to public_reader using (show_online);
create policy barber_services_public_read on public.barber_services for select to public_reader using (true);
create policy working_hours_public_read on public.working_hours for select to public_reader using (true);

grant usage on schema public to public_reader;
grant select on public.shops, public.barbers, public.services, public.barber_services, public.working_hours,
                public.queue_state, public.busy_blocks, public.live_ticks to public_reader;

-- Intake and staff functions are for the server only.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
