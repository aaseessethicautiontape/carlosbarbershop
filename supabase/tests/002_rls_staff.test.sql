-- Staff (owner / barber) permissions.
begin;
select * from no_plan();

-- helper: act as a signed-in user
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as
$$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

-- ---- barber (Estella)
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f2');
set local role authenticated;
select ok((select count(*) from public.clients) > 0,   'barber can read clients');
select ok((select count(*) from public.bookings) > 0,  'barber can read bookings');
select ok((select count(*) from public.walkins) = 4,   'barber can read walkins');
select lives_ok($$ update public.barbers set on_duty = false where id = '00000000-0000-4000-8000-0000000000b3' $$, 'barber can toggle on_duty');
select throws_ok($$ update public.barbers set name = 'Hacked' where id = '00000000-0000-4000-8000-0000000000b3' $$, '42501', 'owner_only', 'barber cannot rename a barber');
select lives_ok($$ update public.services set price_cents = 1 $$, 'barber price update is silently filtered by RLS');
select is((select count(*)::int from public.services where price_cents = 1), 0, 'barber cannot change service prices');
select throws_ok($$ insert into public.barbers (shop_id, name, initials) values ('00000000-0000-4000-8000-000000000001', 'New', 'N') $$, '42501', null, 'barber cannot add a barber');
select lives_ok($$ delete from public.clients $$, 'barber delete is silently filtered by RLS');
select ok((select count(*) from public.clients) = 22, 'barber cannot delete clients');
select lives_ok($$ update public.message_settings set email_enabled = false $$, 'barber settings update is silently filtered by RLS');
select ok((select email_enabled from public.message_settings where template_key = 'confirmation'), 'barber cannot change message settings');
select lives_ok($$ select * from public.notifications_log $$, 'barber can read the outbox');
reset role;

-- ---- owner (Carlo)
select pg_temp.act_as('00000000-0000-4000-8000-0000000000f1');
set local role authenticated;
select lives_ok($$ update public.services set price_cents = 3500 where id = '00000000-0000-4000-8000-0000000000a1' $$, 'owner can set a price');
select lives_ok($$ update public.barbers set name = 'Carlo S.' where id = '00000000-0000-4000-8000-0000000000b1' $$, 'owner can edit barbers');
select ok((select count(*) from public.profiles) = 2, 'owner sees all profiles');
reset role;

-- ---- a signed-in user with NO profile (e.g. a stray account) gets nothing
select pg_temp.act_as('00000000-0000-4000-8000-00000000dead');
set local role authenticated;
select is((select count(*)::int from public.clients), 0,  'user without a profile sees no clients');
select is((select count(*)::int from public.bookings), 0, 'user without a profile sees no bookings');
select is((select count(*)::int from public.walkins), 0,  'user without a profile sees no walkins');
reset role;

select * from finish();
rollback;
