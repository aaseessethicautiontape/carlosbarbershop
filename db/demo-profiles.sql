-- Links the two demo Neon Auth users (created by scripts/setup-demo-users.ts) to staff profiles. DEMO ONLY.
insert into public.profiles (id, shop_id, role, display_name, barber_id)
select u.id::uuid, '00000000-0000-4000-8000-000000000001',
       case u.email when 'owner@carlos.test' then 'owner'::public.app_role else 'barber'::public.app_role end,
       case u.email when 'owner@carlos.test' then 'Carlo S.' else 'Estella' end,
       case u.email when 'owner@carlos.test' then '00000000-0000-4000-8000-0000000000b1'::uuid else '00000000-0000-4000-8000-0000000000b4'::uuid end
from neon_auth."user" u where u.email in ('owner@carlos.test', 'barber@carlos.test')
on conflict (id) do nothing;
