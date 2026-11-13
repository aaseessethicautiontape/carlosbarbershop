-- Helpers, triggers and RPCs. Everything that bypasses RLS lives in SECURITY DEFINER
-- functions with an empty search_path, and is executable only by the roles that need it (see 0003).

-- ---------------------------------------------------------------- auth helpers
create function private.my_shop_id() returns uuid
  language sql stable security definer set search_path = '' as
$$ select shop_id from public.profiles where id = auth.uid() $$;

create function private.is_staff() returns boolean
  language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.profiles where id = auth.uid()) $$;

create function private.is_owner() returns boolean
  language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') $$;

-- True when the caller is the server (service role / migrations), not an end user.
create function private.is_server() returns boolean
  language sql stable as
$$ select current_user in ('postgres', 'supabase_admin', 'service_role') $$;

-- ------------------------------------------------------ wait-time estimate
-- Position p (1 = next). Free chairs take the first p <= free people at once; after that the
-- first wave waits ~half a cut for busy chairs to free up, then one full cut per extra wave.
create function private.est_wait(p_pos int, p_free int, p_duty int, p_avg int) returns int
  language plpgsql immutable as
$$
declare v int;
begin
  if p_duty <= 0 then return null; end if;
  if p_pos <= p_free then return 0; end if;
  v := (p_avg / 2) + (((p_pos - p_free - 1) / p_duty) * p_avg);
  return (round(v / 5.0) * 5)::int;
end $$;

create function private.refresh_queue_state(p_shop uuid) returns void
  language plpgsql security definer set search_path = '' as
$$
declare
  v_shop public.shops;
  v_waiting int; v_duty int; v_busy int; v_free int;
begin
  select * into v_shop from public.shops where id = p_shop;
  if not found then return; end if;
  select count(*) into v_waiting from public.walkins where shop_id = p_shop and status = 'waiting';
  select count(*) into v_duty from public.barbers where shop_id = p_shop and on_duty and is_published;
  select count(*) into v_busy from public.barbers b
    where b.shop_id = p_shop and b.on_duty and b.is_published
      and exists (
        select 1 from public.bookings k
        where k.barber_id = b.id and k.status in ('booked', 'in_chair')
          and tstzrange(k.starts_at, k.ends_at) @> now()
      );
  v_free := greatest(v_duty - v_busy, 0);
  insert into public.queue_state (shop_id, waiting_count, on_duty_count, free_chairs, avg_minutes, est_wait_min, updated_at)
  values (p_shop, v_waiting, v_duty, v_free, v_shop.avg_walkin_minutes,
          private.est_wait(v_waiting + 1, v_free, v_duty, v_shop.avg_walkin_minutes), now())
  on conflict (shop_id) do update set
    waiting_count = excluded.waiting_count, on_duty_count = excluded.on_duty_count, free_chairs = excluded.free_chairs,
    avg_minutes = excluded.avg_minutes, est_wait_min = excluded.est_wait_min, updated_at = excluded.updated_at;
end $$;

-- ------------------------------------------------------------------ triggers
create function private.trg_bookings_sync() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  if tg_op = 'DELETE' then
    delete from public.busy_blocks where id = old.id;
    perform private.refresh_queue_state(old.shop_id);
    return old;
  end if;
  if new.status in ('booked', 'in_chair') then
    insert into public.busy_blocks (id, shop_id, barber_id, kind, during)
    values (new.id, new.shop_id, new.barber_id, 'booking', tstzrange(new.starts_at, new.ends_at))
    on conflict (id) do update set barber_id = excluded.barber_id, during = excluded.during;
  else
    delete from public.busy_blocks where id = new.id;
  end if;
  perform private.refresh_queue_state(new.shop_id);
  return new;
end $$;
create trigger bookings_sync_after after insert or update or delete on public.bookings
  for each row execute function private.trg_bookings_sync();
-- updated_at needs a BEFORE trigger to take effect:
create function private.trg_touch() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
create trigger bookings_touch before update on public.bookings for each row execute function private.trg_touch();

create function private.trg_time_off_sync() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  if tg_op = 'DELETE' then
    delete from public.busy_blocks where id = old.id;
    return old;
  end if;
  insert into public.busy_blocks (id, shop_id, barber_id, kind, during)
  values (new.id, new.shop_id, new.barber_id, 'time_off', tstzrange(new.starts_at, new.ends_at))
  on conflict (id) do update set barber_id = excluded.barber_id, during = excluded.during;
  return new;
end $$;
create trigger time_off_sync after insert or update or delete on public.time_off
  for each row execute function private.trg_time_off_sync();

create function private.trg_walkins_sync() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_queue_state(old.shop_id);
    return old;
  end if;
  perform private.refresh_queue_state(new.shop_id);
  return new;
end $$;
create trigger walkins_sync after insert or update or delete on public.walkins
  for each row execute function private.trg_walkins_sync();

create function private.trg_barbers_sync() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_queue_state(old.shop_id);
    return old;
  end if;
  perform private.refresh_queue_state(new.shop_id);
  return new;
end $$;
create trigger barbers_sync after insert or update of on_duty, is_published or delete on public.barbers
  for each row execute function private.trg_barbers_sync();

create function private.trg_shops_sync() returns trigger
  language plpgsql security definer set search_path = '' as
$$ begin perform private.refresh_queue_state(new.id); return new; end $$;
create trigger shops_sync after insert or update of avg_walkin_minutes on public.shops
  for each row execute function private.trg_shops_sync();

-- Non-owner staff may only flip a barber's on_duty switch; everything else is owner-only.
create function private.trg_barbers_guard() returns trigger language plpgsql as
$$
begin
  if private.is_server() or private.is_owner() then return new; end if;
  if (to_jsonb(new) - 'on_duty') is distinct from (to_jsonb(old) - 'on_duty') then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger barbers_guard before update on public.barbers for each row execute function private.trg_barbers_guard();

-- --------------------------------------------------------------- rate limiting
-- Fixed-window counter. Returns TRUE when the call is allowed.
create function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns boolean
  language plpgsql security definer set search_path = '' as
$$
declare v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- ----------------------------------------------------------------- slot checks
create function private.shop_is_open(p_shop uuid) returns boolean
  language plpgsql stable security definer set search_path = '' as
$$
declare v_tz text; v_local timestamp; v_open time; v_close time; v_off boolean;
begin
  select timezone into v_tz from public.shops where id = p_shop;
  v_local := now() at time zone v_tz;
  select opens, closes, is_off into v_open, v_close, v_off from public.working_hours
    where shop_id = p_shop and barber_id is null and weekday = extract(dow from v_local)::int;
  if not found or v_off then return false; end if;
  return v_local::time >= v_open and v_local::time < v_close;
end $$;

-- Raises one of: too_soon, too_far, outside_hours, barber_off, barber_service_mismatch
create function private.assert_slot_ok(
  p_shop uuid, p_barber uuid, p_service uuid, p_starts timestamptz, p_ends timestamptz, p_enforce_window boolean
) returns void language plpgsql stable security definer set search_path = '' as
$$
declare
  v_shop public.shops; v_ls timestamp; v_le timestamp; v_dow int; v_open time; v_close time; v_off boolean; v_duty boolean;
begin
  select * into v_shop from public.shops where id = p_shop;
  if p_enforce_window then
    if p_starts < now() + make_interval(mins => v_shop.min_lead_minutes) then raise exception 'too_soon'; end if;
    if p_starts > now() + make_interval(days => v_shop.booking_window_days) then raise exception 'too_far'; end if;
  end if;
  v_ls := p_starts at time zone v_shop.timezone;
  v_le := p_ends at time zone v_shop.timezone;
  if v_ls::date <> v_le::date then raise exception 'outside_hours'; end if;
  v_dow := extract(dow from v_ls)::int;

  select is_off, opens, closes into v_off, v_open, v_close from public.working_hours
    where shop_id = p_shop and barber_id = p_barber and weekday = v_dow;
  if not found then
    select is_off, opens, closes into v_off, v_open, v_close from public.working_hours
      where shop_id = p_shop and barber_id is null and weekday = v_dow;
    if not found then raise exception 'outside_hours'; end if;
  end if;
  if v_off or v_ls::time < v_open or v_le::time > v_close then raise exception 'outside_hours'; end if;

  if exists (select 1 from public.time_off t where t.barber_id = p_barber and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts, p_ends)) then
    raise exception 'barber_off';
  end if;
  select on_duty into v_duty from public.barbers where id = p_barber and shop_id = p_shop and is_published;
  if not found then raise exception 'barber_off'; end if;
  if not v_duty and v_ls::date = (now() at time zone v_shop.timezone)::date then raise exception 'barber_off'; end if;
  if not exists (select 1 from public.barber_services where barber_id = p_barber and service_id = p_service) then
    raise exception 'barber_service_mismatch';
  end if;
end $$;

-- ------------------------------------------------------------------ booking RPCs
create function public.create_booking(
  p_shop uuid, p_barber uuid, p_service uuid, p_starts timestamptz,
  p_name text, p_phone text, p_email text default null,
  p_source public.booking_source default 'web', p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as
$$
declare v_svc public.services; v_client uuid; v_id uuid; v_ends timestamptz;
begin
  select * into v_svc from public.services where id = p_service and shop_id = p_shop;
  if not found or (p_source = 'web' and not v_svc.show_online) then raise exception 'service_unavailable'; end if;
  v_ends := p_starts + make_interval(mins => v_svc.duration_minutes);
  perform private.assert_slot_ok(p_shop, p_barber, p_service, p_starts, v_ends, p_source = 'web');

  insert into public.clients (shop_id, name, phone, email, source)
  values (p_shop, p_name, p_phone, nullif(p_email, ''), case when p_source = 'web' then 'web' else 'admin' end)
  on conflict (shop_id, phone) where phone is not null
  do update set email = coalesce(public.clients.email, excluded.email)
  returning id into v_client;

  begin
    insert into public.bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at, source, price_cents_snapshot, notes)
    values (p_shop, p_barber, p_service, v_client, p_starts, v_ends, p_source, v_svc.price_cents, p_notes)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  return v_id;
end $$;

create function public.reschedule_booking(p_booking uuid, p_starts timestamptz, p_barber uuid default null)
  returns void language plpgsql security definer set search_path = '' as
$$
declare v_b public.bookings; v_dur int; v_barber uuid; v_ends timestamptz;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.status <> 'booked' then raise exception 'not_reschedulable'; end if;
  select duration_minutes into v_dur from public.services where id = v_b.service_id;
  v_barber := coalesce(p_barber, v_b.barber_id);
  v_ends := p_starts + make_interval(mins => v_dur);
  perform private.assert_slot_ok(v_b.shop_id, v_barber, v_b.service_id, p_starts, v_ends, true);
  begin
    update public.bookings set barber_id = v_barber, starts_at = p_starts, ends_at = v_ends,
      reminder_24h_sent_at = null, reminder_2h_sent_at = null where id = p_booking;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
end $$;

-- ------------------------------------------------------------------ walk-in RPCs
create function public.join_walkin(p_shop uuid, p_name text, p_phone text, p_service uuid default null)
  returns uuid language plpgsql security definer set search_path = '' as
$$
declare v_shop public.shops; v_client uuid; v_id uuid; v_waiting int;
begin
  select * into v_shop from public.shops where id = p_shop;
  if not found then raise exception 'unknown_shop'; end if;
  if v_shop.walkin_requires_open and not private.shop_is_open(p_shop) then raise exception 'closed'; end if;

  select id into v_id from public.walkins where shop_id = p_shop and phone = p_phone and status = 'waiting';
  if found then return v_id; end if;  -- already in line: hand back the same ticket

  select count(*) into v_waiting from public.walkins where shop_id = p_shop and status = 'waiting';
  if v_waiting >= v_shop.max_queue then raise exception 'queue_full'; end if;
  if not exists (select 1 from public.barbers where shop_id = p_shop and on_duty and is_published) then raise exception 'no_barbers'; end if;

  insert into public.clients (shop_id, name, phone, source) values (p_shop, p_name, p_phone, 'walk_in')
  on conflict (shop_id, phone) where phone is not null do update set name = public.clients.name
  returning id into v_client;

  insert into public.walkins (shop_id, client_id, display_name, phone, service_id)
  values (p_shop, v_client, p_name, p_phone, p_service) returning id into v_id;
  return v_id;
end $$;

-- Position + ETA for ONE ticket (the holder of the signed token). Returns the first name only.
create function public.walkin_status(p_walkin uuid)
  returns table (status public.walkin_status, queue_position int, est_wait_min int, first_name text)
  language plpgsql security definer set search_path = '' as
$$
declare w public.walkins; q public.queue_state; v_pos int;
begin
  select * into w from public.walkins where id = p_walkin;
  if not found then return; end if;
  select * into q from public.queue_state where shop_id = w.shop_id;
  if w.status = 'waiting' then
    select count(*)::int into v_pos from public.walkins x
      where x.shop_id = w.shop_id and x.status = 'waiting' and (x.joined_at, x.id) <= (w.joined_at, w.id);
    return query select w.status, v_pos, private.est_wait(v_pos, q.free_chairs, q.on_duty_count, q.avg_minutes), split_part(w.display_name, ' ', 1);
  else
    return query select w.status, null::int, null::int, split_part(w.display_name, ' ', 1);
  end if;
end $$;

-- Staff action from the shop iPad: seat the walk-in in a chair. Creates an in-chair booking so it
-- shows on the calendar, and marks the ticket seated. One transaction; the overlap constraint
-- stops you seating someone in a chair that is already taken.
create function public.seat_walkin(p_walkin uuid, p_barber uuid) returns uuid
  language plpgsql security definer set search_path = '' as
$$
declare w public.walkins; v_shop public.shops; v_dur int; v_service uuid; v_id uuid; v_client uuid;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into w from public.walkins where id = p_walkin and status = 'waiting' and shop_id = private.my_shop_id() for update;
  if not found then raise exception 'not_waiting'; end if;
  select * into v_shop from public.shops where id = w.shop_id;
  if not exists (select 1 from public.barbers where id = p_barber and shop_id = w.shop_id and on_duty) then raise exception 'barber_off'; end if;

  v_service := coalesce(w.service_id, (select id from public.services where shop_id = w.shop_id order by sort_order limit 1));
  select least(coalesce(duration_minutes, v_shop.avg_walkin_minutes), 60) into v_dur from public.services where id = v_service;
  v_dur := coalesce(v_dur, v_shop.avg_walkin_minutes);
  v_client := w.client_id;
  if v_client is null then
    insert into public.clients (shop_id, name, phone, source) values (w.shop_id, w.display_name, w.phone, 'walk_in') returning id into v_client;
  end if;

  begin
    insert into public.bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at, status, source, price_cents_snapshot, notes)
    values (w.shop_id, p_barber, v_service, v_client, now(), now() + make_interval(mins => v_dur), 'in_chair', 'walk_in',
            (select price_cents from public.services where id = v_service), 'Walk-in')
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'barber_busy';
  end;
  update public.walkins set status = 'seated', seated_at = now(), seated_barber_id = p_barber where id = p_walkin;
  return v_id;
end $$;
