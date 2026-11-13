-- Booking guarantees: no double booking, hours/time-off/window rules, walk-in seating, rate limits.
begin;
select * from no_plan();

-- clean slate inside this transaction (rolled back at the end)
delete from public.bookings;
delete from public.walkins where phone <> '+1705555021';

create temp table t as select
  ('00000000-0000-4000-8000-000000000001')::uuid as shop,
  ('00000000-0000-4000-8000-0000000000b1')::uuid as carlo,
  ('00000000-0000-4000-8000-0000000000b2')::uuid as cosmo,
  ('00000000-0000-4000-8000-0000000000a1')::uuid as haircut,
  -- next Monday 10:00 Toronto time (always inside the 30-day window, and shop is open)
  (((date_trunc('week', (now() at time zone 'America/Toronto') + interval '7 days'))::date + time '10:00') at time zone 'America/Toronto') as mon10,
  (((date_trunc('week', (now() at time zone 'America/Toronto') + interval '7 days'))::date + time '10:15') at time zone 'America/Toronto') as mon1015,
  (((date_trunc('week', (now() at time zone 'America/Toronto') + interval '7 days'))::date + time '08:00') at time zone 'America/Toronto') as mon8,
  (((date_trunc('week', (now() at time zone 'America/Toronto') + interval '7 days'))::date + 6 + time '10:00') at time zone 'America/Toronto') as sun10;

select ok((select public.create_booking(shop, carlo, haircut, mon10, 'Test One', '+17055559001', 'one@example.com') from t) is not null, 'first booking succeeds');

select throws_ok($$ select public.create_booking(shop, carlo, haircut, mon10, 'Test Two', '+17055559002') from t $$, 'P0001', 'slot_taken', 'same barber + same time is rejected');
select throws_ok($$ select public.create_booking(shop, carlo, haircut, mon1015, 'Test Two', '+17055559002') from t $$, 'P0001', 'slot_taken', 'overlapping range is rejected');
select lives_ok($$ select public.create_booking(shop, cosmo, haircut, mon10, 'Test Two', '+17055559002') from t $$, 'a different barber at the same time is fine');

-- the DB constraint itself, bypassing the RPC
select throws_ok($$ insert into public.bookings (shop_id, barber_id, service_id, client_id, starts_at, ends_at)
  select shop, carlo, haircut, (select id from public.clients limit 1), mon10, mon10 + interval '20 min' from t $$, '23P01', null, 'exclusion constraint blocks a raw insert');

select throws_ok($$ select public.create_booking(shop, carlo, haircut, mon8, 'Early', '+17055559003') from t $$, 'P0001', 'outside_hours', 'before opening is rejected');
select throws_ok($$ select public.create_booking(shop, carlo, haircut, sun10, 'Sunday', '+17055559004') from t $$, 'P0001', 'outside_hours', 'closed day is rejected');
select throws_ok($$ select public.create_booking(shop, carlo, haircut, now() + interval '5 minutes', 'Soon', '+17055559005') from t $$, 'P0001', 'too_soon', 'inside the minimum lead time is rejected');
select throws_ok($$ select public.create_booking(shop, carlo, haircut, now() + interval '90 days', 'Far', '+17055559006') from t $$, 'P0001', 'too_far', 'beyond the booking window is rejected');

-- time off blocks booking, and shows up in busy_blocks
insert into public.time_off (shop_id, barber_id, starts_at, ends_at, reason)
  select shop, cosmo, mon10 + interval '1 hour', mon10 + interval '3 hours', 'private reason' from t;
select throws_ok($$ select public.create_booking(shop, cosmo, haircut, mon10 + interval '90 minutes', 'Off', '+17055559007') from t $$, 'P0001', 'barber_off', 'time off blocks booking');
select ok((select count(*) from public.busy_blocks where kind = 'time_off') = 1, 'time off is mirrored into busy_blocks (without the reason)');

-- busy_blocks follows bookings, cancelled ones disappear
select ok((select count(*) from public.busy_blocks where kind = 'booking') = 2, 'bookings are mirrored into busy_blocks');
update public.bookings set status = 'cancelled' where client_id = (select id from public.clients where phone = '+17055559001');
select ok((select count(*) from public.busy_blocks where kind = 'booking') = 1, 'cancelled booking leaves busy_blocks');
select lives_ok($$ select public.create_booking(shop, carlo, haircut, mon10, 'Test Three', '+17055559008') from t $$, 'a cancelled slot can be rebooked');

-- reschedule
select lives_ok($$ select public.reschedule_booking((select id from public.bookings where client_id = (select id from public.clients where phone = '+17055559008')), mon1015 + interval '30 minutes') from t $$, 'reschedule to a free slot');
select throws_ok($$ select public.reschedule_booking((select id from public.bookings where client_id = (select id from public.clients where phone = '+17055559008')), mon10 + interval '12 hours') from t $$, 'P0001', 'outside_hours', 'reschedule to an invalid slot is rejected');

-- client upsert by phone
select is((select count(*)::int from public.clients where phone = '+17055559002'), 1, 'same phone is one client');

-- walk-in line + seating
select ok((select count(*) from public.queue_state where waiting_count = 1) = 1, 'queue_state tracks the line');
select is((select count(*)::int from public.walkins where status = 'waiting'), 1, 'one waiting walk-in left');
select ok(public.join_walkin((select shop from t), 'Pat', '+17055559100') is not null, 'join_walkin works');
select ok(public.join_walkin((select shop from t), 'Pat', '+17055559100') = (select id from public.walkins where phone = '+17055559100'), 'joining twice returns the same ticket');
select is((select queue_position from public.walkin_status((select id from public.walkins where phone = '+17055559100'))), 2, 'Pat is #2');
select is((select first_name from public.walkin_status((select id from public.walkins where phone = '+17055559100'))), 'Pat', 'status returns first name only');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select lives_ok($$ select public.seat_walkin((select id from public.walkins where phone = '+17055559100'), '00000000-0000-4000-8000-0000000000b3') $$, 'staff can seat a walk-in');
select throws_ok($$ select public.seat_walkin((select id from public.walkins where phone = '+1705555021'), '00000000-0000-4000-8000-0000000000b3') $$, 'P0001', 'barber_busy', 'cannot seat into a chair that is taken');
reset role;
select is((select status::text from public.walkins where phone = '+17055559100'), 'seated', 'walk-in marked seated');
select ok(exists (select 1 from public.bookings where source = 'walk_in' and status = 'in_chair'), 'seating creates an in-chair booking');
select ok((select waiting_count from public.queue_state) = 1, 'queue shrinks after seating');

-- rate limiter
select ok(public.hit_rate_limit('test:a', 60, 2), 'hit 1 allowed');
select ok(public.hit_rate_limit('test:a', 60, 2), 'hit 2 allowed');
select ok(not public.hit_rate_limit('test:a', 60, 2), 'hit 3 blocked');
select ok(public.hit_rate_limit('test:b', 60, 2), 'a different key is independent');

select * from finish();
rollback;
