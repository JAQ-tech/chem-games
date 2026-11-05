-- Acceptance checks against a seeded database.
-- The clock is pinned to Sunday 1 Nov 2026, 07:00 Asia/Muscat, so every
-- period that day is still in the future (period 1 starts at 07:10).

select set_config('manhal.today', '2026-11-01', false);
select set_config('manhal.now_time', '07:00', false);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', '900001@lrc.local'),
  ('00000000-0000-0000-0000-000000000002', '900002@lrc.local'),
  ('00000000-0000-0000-0000-000000000003', '900003@lrc.local'),
  ('00000000-0000-0000-0000-000000000004', '900004@lrc.local'),
  ('00000000-0000-0000-0000-000000000005', '900005@lrc.local'),
  ('00000000-0000-0000-0000-000000000006', '900006@lrc.local'),
  ('00000000-0000-0000-0000-000000000007', '900007@lrc.local')
on conflict (id) do nothing;

insert into staff (file_no, full_name, job_type, subject, role, user_id) values
  ('900006', 'خالد بن سالم الاختبار', 'teaching', 'الرياضيات', 'staff', '00000000-0000-0000-0000-000000000006'),
  ('900007', 'سعيد بن حمد الاختبار', 'teaching', 'العلوم', 'staff', '00000000-0000-0000-0000-000000000007')
on conflict (file_no) do nothing;

update staff set user_id = '00000000-0000-0000-0000-000000000001' where file_no = '900001';
update staff set user_id = '00000000-0000-0000-0000-000000000002' where file_no = '900002';
update staff set user_id = '00000000-0000-0000-0000-000000000003' where file_no = '900003';
update staff set user_id = '00000000-0000-0000-0000-000000000004' where file_no = '900004';
update staff set user_id = '00000000-0000-0000-0000-000000000005' where file_no = '900005';
update staff set user_id = '00000000-0000-0000-0000-000000000006' where file_no = '900006';
update staff set user_id = '00000000-0000-0000-0000-000000000007' where file_no = '900007';

grant usage on schema public to manhal_user;
grant select, insert, update, delete on all tables in schema public to manhal_user;
grant usage, select on all sequences in schema public to manhal_user;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
set role manhal_user;

-- Lesson without class, subject, or title is rejected.
do $$
begin
  perform create_booking('2026-11-01', array[3]::smallint[], 'lesson', null, null, null, null, null, null, null, null);
  raise exception 'lesson without fields was accepted';
exception when others then
  if position('KIND_FIELDS' in SQLERRM) = 0 then raise; end if;
end $$;

-- Event without a title or a headcount is rejected.
do $$
begin
  perform create_booking('2026-11-01', array[3]::smallint[], 'event', null, null, null, null, null, null, null, null);
  raise exception 'event without fields was accepted';
exception when others then
  if position('KIND_FIELDS' in SQLERRM) = 0 then raise; end if;
end $$;

-- Event with a title and a headcount, and no class or subject, is accepted.
do $$
declare g uuid;
begin
  g := create_booking('2026-11-01', array[6]::smallint[], 'event', null, null, null, 'ندوة القراءة', 'مكتبة عامة', 25, 'جهاز عرض', null);
  if g is null then raise exception 'event was not created'; end if;
  if exists (select 1 from bookings where group_id = g and (class_section is not null or subject is not null)) then
    raise exception 'event stored lesson fields';
  end if;
end $$;

-- Non-consecutive periods are rejected.
do $$
begin
  perform create_booking('2026-11-01', array[1, 3]::smallint[], 'lesson', '8-2', 'الرياضيات', 'الكسور', null, null, null, null, null);
  raise exception 'gap was accepted';
exception when others then
  if position('NOT_CONSECUTIVE' in SQLERRM) = 0 then raise; end if;
end $$;

-- Friday is rejected.
do $$
begin
  perform create_booking('2026-11-06', array[1]::smallint[], 'lesson', '8-2', 'الرياضيات', 'الكسور', null, null, null, null, null);
  raise exception 'friday was accepted';
exception when others then
  if position('WEEKEND' in SQLERRM) = 0 and position('check' in SQLERRM) = 0 then raise; end if;
end $$;

-- Next week is closed until Sunday.
do $$
begin
  perform create_booking('2026-11-08', array[1]::smallint[], 'lesson', '8-2', 'الرياضيات', 'الكسور', null, null, null, null, null);
  raise exception 'next week was accepted';
exception when others then
  if position('OUTSIDE_WEEK' in SQLERRM) = 0 then raise; end if;
end $$;

-- A holiday blocks the slot.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role manhal_user;
select add_holiday('2026-11-02', 2::smallint, 'اجتماع', false);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
set role manhal_user;
do $$
begin
  perform create_booking('2026-11-02', array[2]::smallint[], 'lesson', '8-2', 'الرياضيات', 'الكسور', null, null, null, null, null);
  raise exception 'holiday slot was accepted';
exception when others then
  if position('HOLIDAY' in SQLERRM) = 0 then raise; end if;
end $$;

-- Consecutive periods are stored as one group.
do $$
declare g uuid;
begin
  g := create_booking('2026-11-01', array[3, 4]::smallint[], 'lesson', '8-2', 'الرياضيات', 'الكسور', null, null, null, null, 'ملاحظات');
  if (select count(*) from bookings where group_id = g) <> 2 then
    raise exception 'consecutive group size';
  end if;
  if (select count(distinct status) from bookings where group_id = g) <> 1 then
    raise exception 'group status split';
  end if;
end $$;

-- A second teacher can file a competing request. A staff member cannot decide.
do $$
declare g uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
  g := create_booking('2026-11-01', array[3]::smallint[], 'lesson', '9-1', 'العلوم', 'الخلايا', null, null, null, null, null);
  begin
    perform decide_booking(g, true, null);
    raise exception 'staff decided';
  exception when others then
    if position('FORBIDDEN' in SQLERRM) = 0 then raise; end if;
  end;
end $$;

-- Staff cannot read another person's notifications.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
  select count(*) into n from notifications
   where staff_id = (select id from staff where file_no = '900004');
  if n <> 0 then raise exception 'staff read specialist notifications: %', n; end if;
end $$;

-- Staff cannot cancel someone else's booking.
do $$
declare g uuid;
declare affected int;
begin
  select group_id into g from bookings
   where staff_id = (select id from staff where file_no = '900007') and status = 'pending'
   limit 1;
  update bookings set status = 'cancelled' where group_id = g;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'staff cancelled another booking'; end if;
  if (select status from bookings where group_id = g limit 1) is distinct from 'pending' then
    raise exception 'other booking changed';
  end if;
end $$;

-- Principal sees every booking and has no decide permission.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
set role manhal_user;
do $$
declare n int;
declare g uuid;
begin
  select count(*) into n from bookings;
  if n < 2 then raise exception 'principal cannot see bookings'; end if;
  if not can_view_reports() then raise exception 'principal cannot view reports'; end if;
  if is_manager() then raise exception 'principal is a manager'; end if;
  select group_id into g from bookings where status = 'pending' limit 1;
  begin
    perform decide_booking(g, true, null);
    raise exception 'principal decided';
  exception when others then
    if position('FORBIDDEN' in SQLERRM) = 0 then raise; end if;
  end;
end $$;

-- Specialist approval rejects the competing request and notifies both people.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role manhal_user;
do $$
declare g uuid;
declare owner uuid;
declare other uuid;
begin
  select group_id into g from bookings
   where staff_id = (select id from staff where file_no = '900006')
     and kind = 'lesson' and status = 'pending'
   limit 1;
  perform decide_booking(g, true, null);
  if exists (select 1 from bookings where group_id = g and status is distinct from 'approved') then
    raise exception 'group was not approved as a unit';
  end if;
  if (select count(*) from bookings where day = '2026-11-01' and period = 3 and status = 'approved') <> 1 then
    raise exception 'more than one approved booking on the slot';
  end if;
  if exists (
    select 1 from bookings
    where staff_id = (select id from staff where file_no = '900007')
      and day = '2026-11-01' and period = 3 and status is distinct from 'rejected'
  ) then
    raise exception 'competitor was not rejected';
  end if;

  owner := (select id from staff where file_no = '900006');
  other := (select id from staff where file_no = '900007');
end $$;

-- Notifications and the audit row are checked as the table owner because
-- each employee can read only their own notifications.
reset role;
do $$
begin
  if not exists (
    select 1 from notifications
    where staff_id = (select id from staff where file_no = '900004')
      and title like '%طلب حجز جديد%'
  ) then
    raise exception 'specialist was not notified of the new request';
  end if;
  if not exists (
    select 1 from notifications
    where staff_id = (select id from staff where file_no = '900006')
      and body like '%تم قبول حجزك%'
  ) then
    raise exception 'owner was not told the booking was approved';
  end if;
  if not exists (
    select 1 from notifications
    where staff_id = (select id from staff where file_no = '900007')
      and body like '%رُفض حجزك%'
  ) then
    raise exception 'competitor was not notified';
  end if;
  if not exists (select 1 from audit_log where action = 'approve') then
    raise exception 'approve was not audited';
  end if;
end $$;

-- The partial unique index rejects a second approved row even if the
-- application trigger is switched off.
alter table bookings disable trigger bookings_before_insert;
do $$
begin
  insert into bookings (day, period, staff_id, kind, class_section, subject, lesson_title, status)
  values (
    '2026-11-01', 3,
    (select id from staff where file_no = '900004'),
    'lesson', '7-1', 'العلوم', 'تجربة', 'approved'
  );
  raise exception 'second approved row inserted';
exception when unique_violation then
  null;
end $$;
alter table bookings enable trigger bookings_before_insert;

-- Admin cannot grant superadmin.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role manhal_user;
do $$
begin
  update staff set role = 'superadmin' where file_no = '900006';
  raise exception 'admin granted superadmin';
exception when others then
  if position('ROLE_FORBIDDEN' in SQLERRM) = 0 then raise; end if;
end $$;

do $$
begin
  update staff set role = 'superadmin' where file_no = '900002';
  raise exception 'admin promoted self';
exception when others then
  if position('ROLE_FORBIDDEN' in SQLERRM) = 0 then raise; end if;
end $$;

-- Started period and a blocked confirmation path.
reset role;
select set_config('manhal.now_time', '08:00', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
set role manhal_user;
do $$
begin
  perform create_booking('2026-11-01', array[1]::smallint[], 'lesson', '8-2', 'الرياضيات', 'بدأت', null, null, null, null, null);
  raise exception 'started period was accepted';
exception when others then
  if position('STARTED' in SQLERRM) = 0 then raise; end if;
end $$;

-- Break is not a bookable period: there is no period row between 4 and 5,
-- and period 5 still starts at 10:05.
do $$
begin
  if (select count(*) from periods) <> 7 then raise exception 'period count'; end if;
  if (select starts::text from periods where n = 4) <> '09:10:00' then raise exception 'period 4'; end if;
  if (select starts::text from periods where n = 5) <> '10:05:00' then raise exception 'period 5'; end if;
  if (select value->>'starts' from settings where key = 'break') <> '09:45' then raise exception 'break'; end if;
end $$;

-- Class list matches جِسْر without 12س.
do $$
begin
  if (select count(*) from class_sections) <> 30 then raise exception 'section count'; end if;
  if exists (select 1 from class_sections where label = '12س') then raise exception '12س present'; end if;
  if (select label from class_sections order by id desc limit 1) <> '10س' then raise exception 'last section'; end if;
end $$;

reset role;
select 'acceptance-ok' as result;
