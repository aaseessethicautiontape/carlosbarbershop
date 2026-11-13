-- An anonymous visitor (anon key, no login) must see only the public-safe tables and must not write anything.
begin;
select * from no_plan();

set local role anon;

-- allowed reads
select ok((select count(*) from public.services) = 7,           'anon can read shown services');
select ok((select count(*) from public.barbers) = 7,            'anon can read published barbers');
select ok((select count(*) from public.queue_state) = 1,        'anon can read queue_state');
select ok((select count(*) from public.working_hours) >= 6,     'anon can read working hours');
select ok((select count(*) from public.shops) = 1,              'anon can read the shop');
select lives_ok($$ select * from public.busy_blocks $$,          'anon can read busy_blocks');

-- forbidden reads: no table privilege at all
select throws_ok($$ select * from public.clients $$,            '42501', null, 'anon cannot read clients');
select throws_ok($$ select * from public.bookings $$,           '42501', null, 'anon cannot read bookings');
select throws_ok($$ select * from public.walkins $$,            '42501', null, 'anon cannot read walkins');
select throws_ok($$ select * from public.walkins_ranked $$,     '42501', null, 'anon cannot read walkins_ranked');
select throws_ok($$ select * from public.time_off $$,           '42501', null, 'anon cannot read time_off');
select throws_ok($$ select * from public.notifications_log $$,  '42501', null, 'anon cannot read notifications_log');
select throws_ok($$ select * from public.message_settings $$,   '42501', null, 'anon cannot read message_settings');
select throws_ok($$ select * from public.profiles $$,           '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.rate_limits $$,        '42501', null, 'anon cannot read rate_limits');

-- forbidden writes
select throws_ok($$ insert into public.clients (shop_id, name) values ('00000000-0000-4000-8000-000000000001', 'x') $$, '42501', null, 'anon cannot insert clients');
select throws_ok($$ insert into public.walkins (shop_id, display_name) values ('00000000-0000-4000-8000-000000000001', 'x') $$, '42501', null, 'anon cannot insert walkins');
select throws_ok($$ update public.services set price_cents = 1 $$, '42501', null, 'anon cannot update services');
select throws_ok($$ update public.barbers set on_duty = false $$,  '42501', null, 'anon cannot update barbers');
select throws_ok($$ delete from public.queue_state $$,             '42501', null, 'anon cannot delete queue_state');
select throws_ok($$ insert into public.busy_blocks (id, shop_id, barber_id, kind, during) values (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'booking', tstzrange(now(), now() + interval '1 hour')) $$, '42501', null, 'anon cannot forge busy_blocks');

-- forbidden RPCs: intake functions are server (service role) only
select throws_ok($$ select public.create_booking('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1', now() + interval '2 days', 'x', '+17055550000') $$, '42501', null, 'anon cannot call create_booking');
select throws_ok($$ select public.join_walkin('00000000-0000-4000-8000-000000000001', 'x', '+17055550000') $$, '42501', null, 'anon cannot call join_walkin');
select throws_ok($$ select public.hit_rate_limit('k', 60, 5) $$, '42501', null, 'anon cannot call hit_rate_limit');
select throws_ok($$ select public.walkin_status(gen_random_uuid()) $$, '42501', null, 'anon cannot call walkin_status');
select throws_ok($$ select public.seat_walkin(gen_random_uuid(), gen_random_uuid()) $$, '42501', null, 'anon cannot call seat_walkin');

-- the public mirror carries no personal data
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name in ('queue_state', 'busy_blocks')
    and column_name in ('name', 'display_name', 'phone', 'email', 'client_id')), 'public mirror tables have no PII columns');

select * from finish();
rollback;
