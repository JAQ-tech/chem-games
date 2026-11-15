-- Enable Supabase Realtime for the bell and the timetable.
-- Safe to run more than once. Skipped when the publication does not exist.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.bookings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
