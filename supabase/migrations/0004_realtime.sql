-- Realtime. Anonymous clients can only subscribe to tables they can SELECT (RLS applies to Realtime):
-- queue_state, busy_blocks, barbers. Staff get bookings + walkins live.
alter publication supabase_realtime add table public.queue_state, public.busy_blocks, public.barbers, public.bookings, public.walkins;
alter table public.queue_state replica identity full;
alter table public.busy_blocks replica identity full;
alter table public.barbers replica identity full;
alter table public.bookings replica identity full;
alter table public.walkins replica identity full;
