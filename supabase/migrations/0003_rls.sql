-- Row Level Security on EVERY table, forced. Default-deny; each policy below is an explicit allow.
-- Public (anon) can read only: shops, published barbers, shown services, barber_services,
-- working_hours, queue_state and busy_blocks. Nothing else. No public writes at all:
-- public intake goes through server actions using the service role.

alter table public.shops enable row level security;            alter table public.shops force row level security;
alter table public.profiles enable row level security;         alter table public.profiles force row level security;
alter table public.barbers enable row level security;          alter table public.barbers force row level security;
alter table public.services enable row level security;         alter table public.services force row level security;
alter table public.barber_services enable row level security;  alter table public.barber_services force row level security;
alter table public.working_hours enable row level security;    alter table public.working_hours force row level security;
alter table public.time_off enable row level security;         alter table public.time_off force row level security;
alter table public.clients enable row level security;          alter table public.clients force row level security;
alter table public.bookings enable row level security;         alter table public.bookings force row level security;
alter table public.walkins enable row level security;          alter table public.walkins force row level security;
alter table public.queue_state enable row level security;      alter table public.queue_state force row level security;
alter table public.busy_blocks enable row level security;      alter table public.busy_blocks force row level security;
alter table public.message_settings enable row level security; alter table public.message_settings force row level security;
alter table public.notifications_log enable row level security; alter table public.notifications_log force row level security;
alter table public.rate_limits enable row level security;      alter table public.rate_limits force row level security;
-- rate_limits: no policies at all = nobody but the service role (which bypasses RLS) can touch it.

-- ------------------------------------------------------------- table grants (least privilege)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

grant usage on schema private to anon, authenticated;
grant execute on function private.my_shop_id(), private.is_staff(), private.is_owner(), private.is_server() to anon, authenticated;

grant select on public.shops, public.barbers, public.services, public.barber_services, public.working_hours,
                public.queue_state, public.busy_blocks to anon;

grant select, insert, update, delete on public.shops, public.barbers, public.services, public.barber_services,
  public.working_hours, public.time_off, public.clients, public.bookings, public.walkins, public.message_settings to authenticated;
grant select on public.queue_state, public.busy_blocks, public.notifications_log, public.walkins_ranked to authenticated;
grant select, update on public.profiles to authenticated;

-- ----------------------------------------------------------------------- policies
-- shops
create policy shops_public_read on public.shops for select to anon, authenticated using (true);
create policy shops_owner_update on public.shops for update to authenticated
  using (private.is_owner() and id = private.my_shop_id()) with check (private.is_owner() and id = private.my_shop_id());

-- profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (private.is_owner() and shop_id = private.my_shop_id()));
create policy profiles_owner_update on public.profiles for update to authenticated
  using (private.is_owner() and shop_id = private.my_shop_id()) with check (private.is_owner() and shop_id = private.my_shop_id());

-- barbers (staff may flip on_duty; a trigger blocks any other column for non-owners)
create policy barbers_public_read on public.barbers for select to anon, authenticated using (is_published);
create policy barbers_staff_read on public.barbers for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy barbers_staff_update on public.barbers for update to authenticated
  using (private.is_staff() and shop_id = private.my_shop_id()) with check (private.is_staff() and shop_id = private.my_shop_id());
create policy barbers_owner_insert on public.barbers for insert to authenticated with check (private.is_owner() and shop_id = private.my_shop_id());
create policy barbers_owner_delete on public.barbers for delete to authenticated using (private.is_owner() and shop_id = private.my_shop_id());

-- services
create policy services_public_read on public.services for select to anon, authenticated using (show_online);
create policy services_staff_read on public.services for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy services_owner_write on public.services for all to authenticated
  using (private.is_owner() and shop_id = private.my_shop_id()) with check (private.is_owner() and shop_id = private.my_shop_id());

-- barber_services / working_hours
create policy barber_services_read on public.barber_services for select to anon, authenticated using (true);
create policy barber_services_owner_write on public.barber_services for all to authenticated
  using (private.is_owner()) with check (private.is_owner());
create policy working_hours_read on public.working_hours for select to anon, authenticated using (true);
create policy working_hours_owner_write on public.working_hours for all to authenticated
  using (private.is_owner() and shop_id = private.my_shop_id()) with check (private.is_owner() and shop_id = private.my_shop_id());

-- time_off (staff only)
create policy time_off_staff_rw on public.time_off for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy time_off_staff_insert on public.time_off for insert to authenticated with check (private.is_staff() and shop_id = private.my_shop_id());
create policy time_off_staff_update on public.time_off for update to authenticated
  using (private.is_staff() and shop_id = private.my_shop_id()) with check (private.is_staff() and shop_id = private.my_shop_id());
create policy time_off_owner_delete on public.time_off for delete to authenticated using (private.is_owner() and shop_id = private.my_shop_id());

-- clients / bookings / walkins: staff only. NO anon policy = anon sees nothing.
create policy clients_staff_select on public.clients for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy clients_staff_insert on public.clients for insert to authenticated with check (private.is_staff() and shop_id = private.my_shop_id());
create policy clients_staff_update on public.clients for update to authenticated
  using (private.is_staff() and shop_id = private.my_shop_id()) with check (private.is_staff() and shop_id = private.my_shop_id());
create policy clients_owner_delete on public.clients for delete to authenticated using (private.is_owner() and shop_id = private.my_shop_id());

create policy bookings_staff_select on public.bookings for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy bookings_staff_insert on public.bookings for insert to authenticated with check (private.is_staff() and shop_id = private.my_shop_id());
create policy bookings_staff_update on public.bookings for update to authenticated
  using (private.is_staff() and shop_id = private.my_shop_id()) with check (private.is_staff() and shop_id = private.my_shop_id());
create policy bookings_owner_delete on public.bookings for delete to authenticated using (private.is_owner() and shop_id = private.my_shop_id());

create policy walkins_staff_select on public.walkins for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy walkins_staff_insert on public.walkins for insert to authenticated with check (private.is_staff() and shop_id = private.my_shop_id());
create policy walkins_staff_update on public.walkins for update to authenticated
  using (private.is_staff() and shop_id = private.my_shop_id()) with check (private.is_staff() and shop_id = private.my_shop_id());
create policy walkins_owner_delete on public.walkins for delete to authenticated using (private.is_owner() and shop_id = private.my_shop_id());

-- public-safe mirrors: read-only for everyone (written only by SECURITY DEFINER triggers)
create policy queue_state_read on public.queue_state for select to anon, authenticated using (true);
create policy busy_blocks_read on public.busy_blocks for select to anon, authenticated using (true);

-- messaging
create policy message_settings_read on public.message_settings for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());
create policy message_settings_owner_write on public.message_settings for all to authenticated
  using (private.is_owner() and shop_id = private.my_shop_id()) with check (private.is_owner() and shop_id = private.my_shop_id());
create policy notifications_log_staff_read on public.notifications_log for select to authenticated using (private.is_staff() and shop_id = private.my_shop_id());

-- ------------------------------------------------------------ function privileges
-- Everything is revoked from PUBLIC first; then granted back to exactly who needs it.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema private from public;
alter default privileges in schema private revoke execute on functions from public;
grant execute on function private.my_shop_id(), private.is_staff(), private.is_owner(), private.is_server() to anon, authenticated;

grant execute on function public.hit_rate_limit(text, int, int) to service_role;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, public.booking_source, text) to service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz, uuid) to service_role;
grant execute on function public.join_walkin(uuid, text, text, uuid) to service_role;
grant execute on function public.walkin_status(uuid) to service_role;
grant execute on function public.seat_walkin(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------ storage: barber photos
insert into storage.buckets (id, name, public) values ('barber-photos', 'barber-photos', true) on conflict (id) do nothing;
create policy barber_photos_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'barber-photos');
create policy barber_photos_owner_write on storage.objects for insert to authenticated with check (bucket_id = 'barber-photos' and private.is_owner());
create policy barber_photos_owner_update on storage.objects for update to authenticated using (bucket_id = 'barber-photos' and private.is_owner());
create policy barber_photos_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'barber-photos' and private.is_owner());
