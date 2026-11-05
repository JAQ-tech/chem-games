-- مَنْهَل — row level security and grants.
-- anon and authenticated exist on Supabase. Local tests create them first.

alter table staff enable row level security;
alter table bookings enable row level security;
alter table holidays enable row level security;
alter table notifications enable row level security;
alter table periods enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;
alter table class_sections enable row level security;
alter table subject_holds enable row level security;

create policy cs_read on class_sections for select using (true);
create policy sh_read on subject_holds for select using (true);
create policy cs_write on class_sections for all
  using (my_role() in ('superadmin', 'admin'))
  with check (my_role() in ('superadmin', 'admin'));

create policy staff_read on staff for select using (auth.uid() is not null);
create policy staff_write on staff for all
  using (my_role() in ('superadmin', 'admin'))
  with check (my_role() in ('superadmin', 'admin'));

create policy b_read on bookings for select using (auth.uid() is not null);
create policy b_insert on bookings for insert
  with check (staff_id = (me()).id and status = 'pending');
create policy b_cancel_own on bookings for update
  using (staff_id = (me()).id and status in ('pending', 'approved') and day >= current_date)
  with check (status = 'cancelled');
create policy b_manage on bookings for update using (is_manager());

create policy h_read on holidays for select using (auth.uid() is not null);
create policy h_write on holidays for all
  using (is_manager())
  with check (is_manager());

create policy p_read on periods for select using (true);
create policy p_write on periods for all using (my_role() = 'superadmin');

create policy s_read on settings for select using (true);
create policy s_write on settings for all using (my_role() = 'superadmin');

create policy n_own on notifications for select using (staff_id = (me()).id);
create policy n_mark on notifications for update using (staff_id = (me()).id);

create policy a_read on audit_log for select using (my_role() = 'superadmin');

grant usage on schema public to anon, authenticated;

grant select on periods, class_sections, settings, subject_holds to anon, authenticated;

grant select, insert, update, delete on
  staff, bookings, holidays, notifications, periods, settings, audit_log, class_sections
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;
