-- DEMO DATA ONLY (mock mode). Never run against the live project. Demo staff profiles are created by scripts/setup-demo-users.ts.
-- Facts (address, hours, barber names, service names) come from the design canvas; prices are
-- intentionally NULL so the UI shows [PRICE] until the owner fills them in.

-- ------------------------------------------------------------------ shop
insert into public.shops (id, name, address, city, region, postal_code, phone, public_email,
  booking_window_days, min_lead_minutes, slot_step_minutes, avg_walkin_minutes, walkin_requires_open)
values ('00000000-0000-4000-8000-000000000001', 'Carlo''s Barbershop', '331 Bayfield St', 'Barrie', 'ON', 'L4M 3C2',
  '+17057214400', 'Carlodabarber@gmail.com', 30, 30, 30, 20, false);  -- false: the mock demo accepts walk-ins at any hour

-- --------------------------------------------------------------- barbers
insert into public.barbers (id, shop_id, name, initials, sort_order, on_duty) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Carlo S.',    'CS', 1, true),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'Cosmo F.',    'CF', 2, true),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'Linda',       'L',  3, true),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000000001', 'Estella',     'E',  4, true),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000000001', 'Mike',        'M',  5, false),
  ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-000000000001', 'John F.',     'JF', 6, true),
  ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-000000000001', 'Loretta M.',  'LM', 7, true);

-- -------------------------------------------------------------- services (prices NULL on purpose)
insert into public.services (id, shop_id, name, price_cents, duration_minutes, duration_label, sort_order) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Haircut',                  null, 20, '15 to 20 min', 1),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Haircut and beard trim',   null, 25, '20 to 25 min', 2),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Seniors haircut 65+',      null, 20, '15 to 20 min', 3),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 'Kids haircut, under 12',   null, 20, '15 to 20 min', 4),
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-000000000001', 'Hot towel shave',          null, 25, '20 to 25 min', 5),
  ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-000000000001', 'Hot towel head shave',     null, 25, '25 min',       6),
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-000000000001', 'Beard trim',               null, 15, '10 to 15 min', 7);

insert into public.barber_services (barber_id, service_id)
  select b.id, s.id from public.barbers b cross join public.services s;

-- ----------------------------------------------------------- shop hours (Mon-Fri 9-5:45, Sat 9-4, Sun closed)
insert into public.working_hours (shop_id, barber_id, weekday, opens, closes)
  select '00000000-0000-4000-8000-000000000001', null, d, '09:00', '17:45' from generate_series(1, 5) d;
insert into public.working_hours (shop_id, barber_id, weekday, opens, closes)
  values ('00000000-0000-4000-8000-000000000001', null, 6, '09:00', '16:00');

insert into public.message_settings (shop_id, template_key, email_enabled, sms_enabled) values
  ('00000000-0000-4000-8000-000000000001', 'confirmation', true,  false),
  ('00000000-0000-4000-8000-000000000001', 'reminder_24h', true,  false),
  ('00000000-0000-4000-8000-000000000001', 'reminder_2h',  false, false),
  ('00000000-0000-4000-8000-000000000001', 'walkin_next',  false, true),
  ('00000000-0000-4000-8000-000000000001', 'come_back',    true,  false);

-- ------------------------------------------------------------- demo clients (fictional 555-01xx numbers)
insert into public.clients (shop_id, name, phone, email, source, notes)
select '00000000-0000-4000-8000-000000000001', n.name, '+170555501' || lpad((row_number() over (order by n.name))::text, 2, '0'),
       lower(replace(split_part(n.name, ' ', 1), '.', '')) || '@example.com', 'admin',
       (array['Usual: #2 on sides, scissor top', 'Likes a skin fade', null, 'Bring photo, wants a taper', 'Sensitive skin, no aftershave', 'Regular every 3 weeks'])[1 + (length(n.name) % 6)]
from (values ('Mark Daniels'), ('Tony Russo'), ('Jordan Price'), ('Ryan Kelly'), ('Sam Brooks'), ('Luca Moretti'),
  ('Dev Singh'), ('Chris Tran'), ('Owen Lewis'), ('Ben Walsh'), ('Nate Gill'), ('Eli Fraser'), ('Paul Vance'), ('Marco Conte'),
  ('Josh Adams'), ('Kevin Hart-Lee'), ('Adam Novak'), ('Matt Olsen'), ('Leo Zhang'), ('Isaac Jones'), ('Noah Ellis'), ('Gabe Young')) as n(name);

-- visit history: every client gets 2-5 past completed visits, spread over the last months
insert into public.bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at, status, source, notes)
select '00000000-0000-4000-8000-000000000001',
       (select id from public.barbers order by sort_order offset ((c.rn + 0) % 7) limit 1),
       (select id from public.services order by sort_order offset ((c.rn + v) % 7) limit 1),
       c.id,
       (((now() at time zone 'America/Toronto')::date - (v * 21 + (c.rn % 5) + 2))::timestamp + time '09:00' + make_interval(mins => 30 * (c.rn % 14))) at time zone 'America/Toronto',
       (((now() at time zone 'America/Toronto')::date - (v * 21 + (c.rn % 5) + 2))::timestamp + time '09:00' + make_interval(mins => 30 * (c.rn % 14) + 20)) at time zone 'America/Toronto',
       'done', 'admin', null
from (select id, (row_number() over (order by phone))::int as rn from public.clients) c
cross join generate_series(0, 4) v
where v < 2 + (c.rn % 4);

-- --------------------------------------------------------------------- demo day filler
-- Mock mode calls this when the chosen day is empty so the calendar always has life in it.
create or replace function public.demo_fill_day(p_shop uuid, p_day date) returns int
  language plpgsql security definer set search_path = '' as
$$
declare
  v_tz text; v_dow int; v_open time; v_close time; v_off boolean;
  b record; k int; idx int; v_bi int := 0; n int := 0; v_nclients int;
  v_start timestamptz; v_end timestamptz; v_svc record; v_status public.booking_status; v_client uuid;
  v_per int[] := array[8, 6, 5, 8, 0, 5, 2];
  v_notes text[] := array['Usual: #2 on sides, scissor top', 'Likes a skin fade', 'First visit', 'Bring photo, wants a taper', 'Sensitive skin, no aftershave', 'Regular every 3 weeks'];
begin
  select timezone into v_tz from public.shops where id = p_shop;
  v_dow := extract(dow from p_day)::int;
  select opens, closes, is_off into v_open, v_close, v_off from public.working_hours
    where shop_id = p_shop and barber_id is null and weekday = v_dow;
  if not found or v_off then return 0; end if;
  if exists (select 1 from public.bookings where shop_id = p_shop and source = 'admin' and (starts_at at time zone v_tz)::date = p_day) then return 0; end if;
  select count(*) into v_nclients from public.clients where shop_id = p_shop;
  if v_nclients = 0 then return 0; end if;

  for b in select id from public.barbers where shop_id = p_shop order by sort_order loop
    for k in 0 .. coalesce(v_per[v_bi + 1], 0) - 1 loop
      idx := (k * 2 + (v_bi % 2)) % 16;
      v_start := ((p_day + v_open) + make_interval(mins => idx * 30)) at time zone v_tz;
      select id, duration_minutes, price_cents into v_svc from public.services where shop_id = p_shop order by sort_order offset ((v_bi + k) % 7) limit 1;
      v_end := v_start + make_interval(mins => v_svc.duration_minutes);
      continue when ((v_end at time zone v_tz)::time) > v_close;
      v_status := case
        when v_end < now() then (case when v_bi = 2 and k = 1 then 'no_show' else 'done' end)::public.booking_status
        when v_start <= now() then 'in_chair'::public.booking_status
        else 'booked'::public.booking_status end;
      select id into v_client from public.clients where shop_id = p_shop order by phone offset ((v_bi * 7 + k) % v_nclients) limit 1;
      insert into public.bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at, status, source, price_cents_snapshot, notes)
      values (p_shop, b.id, v_svc.id, v_client, v_start, v_end, v_status, 'admin', v_svc.price_cents, v_notes[1 + ((v_bi + k) % 6)]);
      n := n + 1;
    end loop;
    v_bi := v_bi + 1;
  end loop;
  return n;
end $$;

do $$ begin perform public.demo_fill_day('00000000-0000-4000-8000-000000000001', (now() at time zone 'America/Toronto')::date); end $$;

-- ------------------------------------------------------------------ demo walk-in line
insert into public.walkins (shop_id, client_id, display_name, phone, service_id, joined_at)
select '00000000-0000-4000-8000-000000000001', null, w.name, '+170555502' || w.n, w.svc::uuid, now() - make_interval(mins => w.mins)
from (values ('Frank', '1', 22, '00000000-0000-4000-8000-0000000000a1'), ('Aiden', '2', 14, '00000000-0000-4000-8000-0000000000a4'),
             ('Steve', '3', 9,  '00000000-0000-4000-8000-0000000000a7'), ('Ali',   '4', 3,  '00000000-0000-4000-8000-0000000000a1')) as w(name, n, mins, svc);
