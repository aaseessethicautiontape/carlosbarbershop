-- Carlo's Barbershop: schema. RLS is applied in 0003; functions/triggers in 0002.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;  -- not exposed through the API

create type public.app_role as enum ('owner', 'barber');
create type public.booking_status as enum ('booked', 'in_chair', 'done', 'no_show', 'cancelled');
create type public.booking_source as enum ('web', 'admin', 'walk_in');
create type public.walkin_status as enum ('waiting', 'seated', 'removed', 'left');
create type public.notify_channel as enum ('email', 'sms');
create type public.notify_status as enum ('logged', 'sent', 'failed');

-- ---------------------------------------------------------------- shops
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  region text not null default 'ON',
  postal_code text,
  phone text,
  public_email text,
  timezone text not null default 'America/Toronto',
  booking_window_days int not null default 30 check (booking_window_days between 1 and 365),
  min_lead_minutes int not null default 30 check (min_lead_minutes >= 0),
  slot_step_minutes int not null default 30 check (slot_step_minutes in (10, 15, 20, 30, 60)),
  avg_walkin_minutes int not null default 20 check (avg_walkin_minutes between 5 and 120),
  max_queue int not null default 30 check (max_queue between 1 and 200),
  walkin_requires_open boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  barber_id uuid,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- barbers
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  initials text not null check (length(initials) between 1 and 3),
  bio text,
  photo_path text,
  is_published boolean not null default true,
  on_duty boolean not null default true,  -- live "working today" toggle; only affects same-day availability + walk-in estimates
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_barber_fk foreign key (barber_id) references public.barbers (id) on delete set null;

-- ------------------------------------------------------------- services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text,
  price_cents int check (price_cents is null or price_cents >= 0),  -- NULL renders as [PRICE] until the owner sets it
  duration_minutes int not null check (duration_minutes between 5 and 240),
  duration_label text,
  show_online boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.barber_services (
  barber_id uuid not null references public.barbers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (barber_id, service_id)
);

-- -------------------------------------------------------- working hours
-- barber_id NULL = shop hours. A barber row overrides the shop row for that weekday.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  barber_id uuid references public.barbers (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  opens time not null,
  closes time not null,
  is_off boolean not null default false,
  check (is_off or closes > opens)
);
create unique index working_hours_unique
  on public.working_hours (shop_id, coalesce(barber_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  barber_id uuid not null references public.barbers (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);
create index time_off_barber_idx on public.time_off (barber_id, starts_at);

-- -------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text,
  marketing_ok boolean not null default false,
  source text not null default 'web' check (source in ('web', 'admin', 'walk_in', 'import')),
  created_at timestamptz not null default now()
);
create unique index clients_phone_unique on public.clients (shop_id, phone) where phone is not null;
create index clients_name_idx on public.clients (shop_id, lower(name));

-- ------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  barber_id uuid not null references public.barbers (id),
  service_id uuid not null references public.services (id),
  client_id uuid not null references public.clients (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'booked',
  source public.booking_source not null default 'web',
  price_cents_snapshot int,
  notes text,
  cancelled_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- The real guarantee against double booking, independent of any UI:
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('booked', 'in_chair'))
);
create index bookings_day_idx on public.bookings (shop_id, starts_at);
create index bookings_client_idx on public.bookings (client_id, starts_at desc);

-- -------------------------------------------------------------- walk-ins
create table public.walkins (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  client_id uuid references public.clients (id),
  display_name text not null check (length(display_name) between 1 and 60),
  phone text,
  service_id uuid references public.services (id),
  status public.walkin_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  seated_at timestamptz,
  seated_barber_id uuid references public.barbers (id),
  notified_next_at timestamptz,
  created_at timestamptz not null default now()
);
create index walkins_waiting_idx on public.walkins (shop_id, joined_at) where status = 'waiting';
create unique index walkins_one_waiting_per_phone on public.walkins (shop_id, phone) where status = 'waiting' and phone is not null;

-- ---------------------------------------------- public-safe mirror tables
-- These carry NO personal data. They are what the public site (and Realtime) may read.
create table public.queue_state (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  waiting_count int not null default 0,
  on_duty_count int not null default 0,
  free_chairs int not null default 0,
  avg_minutes int not null default 20,
  est_wait_min int,  -- for someone joining now; NULL = nobody on duty
  updated_at timestamptz not null default now()
);

create table public.busy_blocks (
  id uuid primary key,  -- = booking id / time_off id (meaningless without a signed token)
  shop_id uuid not null references public.shops (id) on delete cascade,
  barber_id uuid not null references public.barbers (id) on delete cascade,
  kind text not null check (kind in ('booking', 'time_off')),
  during tstzrange not null
);
create index busy_blocks_barber_idx on public.busy_blocks using gist (barber_id, during);

-- ------------------------------------------------------------- messaging
create table public.message_settings (
  shop_id uuid not null references public.shops (id) on delete cascade,
  template_key text not null check (template_key in ('confirmation', 'reminder_24h', 'reminder_2h', 'walkin_next', 'come_back')),
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  primary key (shop_id, template_key)
);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  template_key text not null,
  channel public.notify_channel not null,
  to_address text not null,
  subject text,
  body text not null,
  status public.notify_status not null,
  provider_id text,
  error text,
  booking_id uuid references public.bookings (id) on delete set null,
  walkin_id uuid references public.walkins (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notifications_log_created_idx on public.notifications_log (shop_id, created_at desc);

-- ----------------------------------------------------------- rate limits
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

-- Convenience view: position is derived, never stored, so it can't drift.
create view public.walkins_ranked with (security_invoker = true) as
  select w.*, row_number() over (partition by w.shop_id order by w.joined_at, w.id)::int as position
  from public.walkins w
  where w.status = 'waiting';
