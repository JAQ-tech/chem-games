-- مَنْهَل — schema, triggers, and RPCs.
-- Run before rls.sql and seed.sql.
-- The Supabase project must be in Frankfurt (eu-central-1). Do not use a region in India.
-- School time is Asia/Muscat (UTC+4). Tests may pin the clock with the
-- settings manhal.today (YYYY-MM-DD) and manhal.now_time (HH:MM:SS).

create extension if not exists pgcrypto;

create type role_t as enum ('superadmin', 'admin', 'specialist', 'principal', 'staff');
create type booking_kind_t as enum ('lesson', 'event');
create type status_t as enum ('pending', 'approved', 'rejected', 'cancelled');

create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  file_no text unique not null,
  full_name text not null,
  job_type text not null check (job_type in ('teaching', 'admin', 'technical')),
  subject text,
  role role_t not null default 'staff',
  active boolean not null default true,
  created_at timestamptz default now()
);

create table periods (
  n smallint primary key check (n between 1 and 7),
  label_ar text not null,
  label_en text not null,
  starts time,
  ends time
);

create table subject_holds (
  weekday smallint not null check (weekday between 0 and 4),
  period smallint not null references periods(n),
  subject text not null,
  display_name text not null default 'حصة المادة',
  primary key (weekday, period)
);

create table class_sections (
  id smallserial primary key,
  label text unique not null
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  period smallint references periods(n), -- null = the whole day
  reason text,
  created_by uuid references staff(id),
  created_at timestamptz default now()
);

create unique index holidays_one_slot on holidays (day, coalesce(period, 0));

create table bookings (
  id uuid primary key default gen_random_uuid(),
  day date not null check (extract(isodow from day) in (7, 1, 2, 3, 4)), -- Sun..Thu
  period smallint not null references periods(n),
  group_id uuid not null default gen_random_uuid(),
  staff_id uuid not null references staff(id),
  kind booking_kind_t not null default 'lesson',
  class_section text,
  subject text,
  lesson_title text,
  event_title text,
  visitor_party text,
  attendees int check (attendees is null or attendees > 0),
  equipment text,
  notes text,
  status status_t not null default 'pending',
  decided_by uuid references staff(id),
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz default now(),
  constraint kind_fields check (
    (kind = 'lesson' and class_section is not null and subject is not null and lesson_title is not null)
    or (kind = 'event' and event_title is not null and attendees is not null)
  )
);

-- One approved booking per slot (day + period).
create unique index one_approved_per_slot on bookings (day, period) where status = 'approved';

create index bookings_day_idx on bookings (day);
create index bookings_staff_idx on bookings (staff_id);
create index bookings_group_idx on bookings (group_id);
create index bookings_status_idx on bookings (status);

create table notifications (
  id bigserial primary key,
  staff_id uuid not null references staff(id),
  title text not null,
  body text not null,
  booking_id uuid references bookings(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index notifications_staff_idx on notifications (staff_id, read);

create table settings (
  key text primary key,
  value jsonb
);

create table audit_log (
  id bigserial primary key,
  actor uuid,
  action text,
  details jsonb,
  at timestamptz default now()
);

-- Clock -----------------------------------------------------------------

create function school_today() returns date
language sql stable as $$
  select coalesce(
    nullif(current_setting('manhal.today', true), '')::date,
    (now() at time zone 'Asia/Muscat')::date
  )
$$;

create function school_now_time() returns time
language sql stable as $$
  select coalesce(
    nullif(current_setting('manhal.now_time', true), '')::time,
    (now() at time zone 'Asia/Muscat')::time
  )
$$;

create function current_week_sunday() returns date
language sql stable as $$
  select school_today() - extract(dow from school_today())::int
$$;

create function period_started(p smallint) returns boolean
language sql stable as $$
  select exists (
    select 1 from periods
    where n = p and starts is not null and starts <= school_now_time()
  )
$$;

-- Identity --------------------------------------------------------------

create function me() returns staff
language sql stable security definer set search_path = public as $$
  select * from staff where user_id = auth.uid()
$$;

create function my_role() returns role_t
language sql stable security definer set search_path = public as $$
  select role from staff where user_id = auth.uid() and active
$$;

create function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('superadmin', 'admin', 'specialist'), false)
$$;

create function can_view_reports() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('superadmin', 'admin', 'specialist', 'principal'), false)
$$;

-- Bilingual notification payload stored in the text columns.
create function bi(ar text, en text) returns text
language sql immutable as $$
  select jsonb_build_object('ar', ar, 'en', en)::text
$$;

-- Booking guards --------------------------------------------------------

create function check_booking_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sunday date := current_week_sunday();
begin
  if extract(isodow from new.day) in (5, 6) then
    raise exception 'WEEKEND';
  end if;

  if new.day < v_sunday or new.day > v_sunday + 4 then
    raise exception 'OUTSIDE_WEEK';
  end if;

  if new.day < school_today() then
    raise exception 'PAST';
  end if;

  if new.day = school_today() and period_started(new.period) then
    raise exception 'STARTED';
  end if;

  if not exists (select 1 from periods where n = new.period) then
    raise exception 'PERIODS';
  end if;

  if exists (
    select 1 from holidays h
    where h.day = new.day and (h.period is null or h.period = new.period)
  ) then
    raise exception 'HOLIDAY';
  end if;

  if exists (
    select 1 from subject_holds h
    where h.weekday = extract(dow from new.day)::smallint
      and h.period = new.period
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  if exists (
    select 1 from bookings b
    where b.day = new.day and b.period = new.period and b.status = 'approved'
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  if exists (
    select 1 from bookings b
    where b.day = new.day and b.period = new.period
      and b.staff_id = new.staff_id
      and b.status in ('pending', 'approved')
  ) then
    raise exception 'ALREADY_REQUESTED';
  end if;

  if new.kind = 'lesson' then
    if btrim(coalesce(new.class_section, '')) = ''
       or btrim(coalesce(new.subject, '')) = ''
       or btrim(coalesce(new.lesson_title, '')) = '' then
      raise exception 'KIND_FIELDS';
    end if;
  elsif new.kind = 'event' then
    if btrim(coalesce(new.event_title, '')) = ''
       or new.attendees is null or new.attendees <= 0 then
      raise exception 'KIND_FIELDS';
    end if;
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'FORBIDDEN';
  end if;

  return new;
end $$;

create trigger bookings_before_insert
before insert on bookings
for each row execute function check_booking_slot();

-- Consecutive periods that share a group_id, on one day, one requester.
create function check_group_consistent() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_days int;
  v_staff int;
  v_kinds int;
  v_count int;
  v_min int;
  v_max int;
  v_distinct int;
begin
  select count(distinct day), count(distinct staff_id), count(distinct kind),
         count(*), min(period), max(period), count(distinct period)
    into v_days, v_staff, v_kinds, v_count, v_min, v_max, v_distinct
  from bookings
  where group_id = new.group_id;

  if v_days > 1 or v_staff > 1 or v_kinds > 1
     or v_distinct <> v_count
     or v_max - v_min + 1 <> v_count then
    raise exception 'NOT_CONSECUTIVE';
  end if;
  return null;
end $$;

create constraint trigger bookings_group_check
after insert on bookings
deferrable initially deferred
for each row execute function check_group_consistent();

-- A non-manager may only cancel their own not-yet-started booking.
create function booking_update_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_manager() then
    return new;
  end if;

  if new.staff_id is distinct from old.staff_id
     or new.day is distinct from old.day
     or new.period is distinct from old.period
     or new.group_id is distinct from old.group_id
     or new.kind is distinct from old.kind
     or new.class_section is distinct from old.class_section
     or new.subject is distinct from old.subject
     or new.lesson_title is distinct from old.lesson_title
     or new.event_title is distinct from old.event_title
     or new.visitor_party is distinct from old.visitor_party
     or new.attendees is distinct from old.attendees
     or new.equipment is distinct from old.equipment
     or new.notes is distinct from old.notes
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at
     or new.reject_reason is distinct from old.reject_reason
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'FORBIDDEN';
  end if;

  if old.status not in ('pending', 'approved') or new.status is distinct from 'cancelled' then
    raise exception 'FORBIDDEN';
  end if;

  if old.day < school_today() then
    raise exception 'PAST';
  end if;

  if old.day = school_today() and period_started(old.period) then
    raise exception 'STARTED';
  end if;

  return new;
end $$;

create trigger bookings_before_update
before update on bookings
for each row execute function booking_update_guard();

create function notify_new_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if (select count(*) from bookings where group_id = new.group_id) <> 1 then
    return null;
  end if;

  select full_name into v_name from staff where id = new.staff_id;

  insert into notifications (staff_id, title, body, booking_id)
  select s.id,
         bi('طلب حجز جديد', 'New booking request'),
         bi(
           'قدّم ' || coalesce(v_name, '') || ' طلب حجز بتاريخ ' || to_char(new.day, 'YYYY-MM-DD') || '.',
           coalesce(v_name, '') || ' submitted a booking request for ' || to_char(new.day, 'YYYY-MM-DD') || '.'
         ),
         new.id
  from staff s
  where s.role = 'specialist' and s.active;

  return null;
end $$;

create trigger bookings_after_insert_notify
after insert on bookings
for each row execute function notify_new_booking();

create function notify_cancellation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  v_owner uuid;
  v_actor uuid;
  v_booking uuid;
begin
  v_actor := (me()).id;

  for g in
    select distinct n.group_id
    from new_table n
    join old_table o on o.id = n.id
    where n.status = 'cancelled' and o.status is distinct from 'cancelled'
  loop
    select id, staff_id into v_booking, v_owner
    from bookings where group_id = g order by period limit 1;

    insert into notifications (staff_id, title, body, booking_id)
    select s.id,
           bi('إلغاء حجز', 'Booking cancelled'),
           bi('أُلغي حجز في جدول المركز.', 'A resource-centre booking was cancelled.'),
           v_booking
    from staff s
    where s.role = 'specialist' and s.active;

    if v_actor is distinct from v_owner then
      insert into notifications (staff_id, title, body, booking_id)
      values (
        v_owner,
        bi('أُلغي حجزك', 'Your booking was cancelled'),
        bi(
          'أُلغي حجزك من قبل الإدارة أو بسبب حجب الخانة.',
          'Your booking was cancelled by a manager or because the slot was blocked.'
        ),
        v_booking
      );
    end if;

    insert into audit_log (actor, action, details)
    values (v_actor, 'cancel', jsonb_build_object('group_id', g));
  end loop;

  return null;
end $$;

create trigger bookings_after_update_notify
after update on bookings
referencing old table as old_table new table as new_table
for each statement execute function notify_cancellation();

create function notification_update_guard() returns trigger
language plpgsql as $$
begin
  if new.staff_id is distinct from old.staff_id
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.booking_id is distinct from old.booking_id
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;

create trigger notifications_before_update
before update on notifications
for each row execute function notification_update_guard();

-- Only a superadmin may grant or revoke the superadmin and admin roles.
create function guard_staff_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role in ('superadmin', 'admin') and my_role() is distinct from 'superadmin' then
      raise exception 'ROLE_FORBIDDEN';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       and (old.role in ('superadmin', 'admin') or new.role in ('superadmin', 'admin'))
       and my_role() is distinct from 'superadmin' then
      raise exception 'ROLE_FORBIDDEN';
    end if;
  end if;

  return new;
end $$;

create trigger staff_role_guard
before insert or update on staff
for each row execute function guard_staff_roles();

-- RPCs ------------------------------------------------------------------

create function create_booking(
  p_day date,
  p_periods smallint[],
  p_kind booking_kind_t,
  p_class_section text,
  p_subject text,
  p_lesson_title text,
  p_event_title text,
  p_visitor_party text,
  p_attendees int,
  p_equipment text,
  p_notes text
) returns uuid
language plpgsql
security invoker
set search_path = public as $$
declare
  v_me staff;
  v_group uuid := gen_random_uuid();
  v_sorted smallint[];
  v_p smallint;
  v_prev smallint;
begin
  select * into v_me from me();
  if v_me.id is null or not v_me.active then
    raise exception 'FORBIDDEN';
  end if;

  if p_periods is null or coalesce(array_length(p_periods, 1), 0) = 0 then
    raise exception 'PERIODS';
  end if;

  select coalesce(array_agg(n order by n), '{}')
    into v_sorted
  from (select distinct unnest(p_periods) as n) s;

  v_prev := null;
  foreach v_p in array v_sorted loop
    if v_p < 1 or v_p > 7 then
      raise exception 'PERIODS';
    end if;
    if v_prev is not null and v_p <> v_prev + 1 then
      raise exception 'NOT_CONSECUTIVE';
    end if;
    v_prev := v_p;
  end loop;

  if p_kind = 'lesson' then
    if btrim(coalesce(p_class_section, '')) = ''
       or btrim(coalesce(p_subject, '')) = ''
       or btrim(coalesce(p_lesson_title, '')) = '' then
      raise exception 'KIND_FIELDS';
    end if;
  elsif p_kind = 'event' then
    if btrim(coalesce(p_event_title, '')) = ''
       or p_attendees is null or p_attendees <= 0 then
      raise exception 'KIND_FIELDS';
    end if;
  else
    raise exception 'KIND_FIELDS';
  end if;

  foreach v_p in array v_sorted loop
    insert into bookings (
      day, period, group_id, staff_id, kind,
      class_section, subject, lesson_title,
      event_title, visitor_party, attendees, equipment, notes, status
    ) values (
      p_day, v_p, v_group, v_me.id, p_kind,
      case when p_kind = 'lesson' then btrim(p_class_section) end,
      case when p_kind = 'lesson' then btrim(p_subject) end,
      case when p_kind = 'lesson' then btrim(p_lesson_title) end,
      case when p_kind = 'event' then btrim(p_event_title) end,
      case when p_kind = 'event' then nullif(btrim(coalesce(p_visitor_party, '')), '') end,
      case when p_kind = 'event' then p_attendees end,
      nullif(btrim(coalesce(p_equipment, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''),
      'pending'
    );
  end loop;

  return v_group;
end $$;

create function decide_booking(p_group uuid, p_approve boolean, p_reason text) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_actor uuid;
  v_owner uuid;
  v_day date;
  v_periods text;
  v_booking uuid;
  v_reason text;
  r record;
begin
  if not is_manager() then
    raise exception 'FORBIDDEN';
  end if;

  v_actor := (me()).id;

  if not exists (select 1 from bookings where group_id = p_group) then
    raise exception 'NOT_PENDING';
  end if;

  if exists (select 1 from bookings where group_id = p_group and status is distinct from 'pending') then
    raise exception 'NOT_PENDING';
  end if;

  select staff_id, day, id
    into v_owner, v_day, v_booking
  from bookings
  where group_id = p_group
  order by period
  limit 1;

  select string_agg(period::text, '، ' order by period) into v_periods
  from bookings where group_id = p_group;

  if p_approve then
    if exists (
      select 1
      from bookings mine
      join bookings other
        on other.day = mine.day
       and other.period = mine.period
       and other.status = 'approved'
       and other.group_id <> p_group
      where mine.group_id = p_group
    ) or exists (
      select 1
      from bookings mine
      join subject_holds h
        on h.weekday = extract(dow from mine.day)::smallint
       and h.period = mine.period
      where mine.group_id = p_group
    ) then
      raise exception 'SLOT_TAKEN';
    end if;

    begin
      update bookings
         set status = 'approved',
             decided_by = v_actor,
             decided_at = now(),
             reject_reason = null
       where group_id = p_group
         and status = 'pending';
    exception when unique_violation then
      raise exception 'SLOT_TAKEN';
    end;

    -- A competing request is one group. Reject the whole group when any of its
    -- periods lands on a slot this approval just took.
    for r in
      select distinct b.group_id, b.staff_id
      from bookings b
      where b.status = 'pending'
        and b.group_id <> p_group
        and exists (
          select 1 from bookings a
          where a.group_id = p_group
            and a.status = 'approved'
            and a.day = b.day
            and a.period = b.period
        )
    loop
      update bookings
         set status = 'rejected',
             decided_by = v_actor,
             decided_at = now(),
             reject_reason = 'SLOT_TAKEN'
       where group_id = r.group_id
         and status = 'pending';

      insert into notifications (staff_id, title, body, booking_id)
      values (
        r.staff_id,
        bi('رُفض حجزك', 'Your booking was rejected'),
        bi(
          'رُفض حجزك: تم قبول طلب آخر على هذه الخانة.',
          'Your booking was rejected: another request was approved for this slot.'
        ),
        v_booking
      );
    end loop;

    insert into notifications (staff_id, title, body, booking_id)
    values (
      v_owner,
      bi('تم قبول حجزك', 'Your booking was approved'),
      bi(
        'تم قبول حجزك ليوم ' || to_char(v_day, 'YYYY-MM-DD') || ' الحصص ' || coalesce(v_periods, '') || '.',
        'Your booking was approved for ' || to_char(v_day, 'YYYY-MM-DD') || ' periods ' || coalesce(v_periods, '') || '.'
      ),
      v_booking
    );
  else
    v_reason := btrim(coalesce(p_reason, ''));
    if v_reason = '' then
      raise exception 'REASON_REQUIRED';
    end if;

    update bookings
       set status = 'rejected',
           decided_by = v_actor,
           decided_at = now(),
           reject_reason = v_reason
     where group_id = p_group
       and status = 'pending';

    insert into notifications (staff_id, title, body, booking_id)
    values (
      v_owner,
      bi('رُفض حجزك', 'Your booking was rejected'),
      bi('رُفض حجزك: ' || v_reason, 'Your booking was rejected: ' || v_reason),
      v_booking
    );
  end if;

  insert into audit_log (actor, action, details)
  values (
    v_actor,
    case when p_approve then 'approve' else 'reject' end,
    jsonb_build_object('group_id', p_group, 'reason', p_reason)
  );
end $$;

create function cancel_booking(p_group uuid) returns void
language plpgsql
security invoker
set search_path = public as $$
declare
  v_owner uuid;
begin
  select staff_id into v_owner from bookings where group_id = p_group limit 1;
  if v_owner is null then
    raise exception 'NOT_CANCELLABLE';
  end if;

  if v_owner is distinct from (me()).id and not is_manager() then
    raise exception 'FORBIDDEN';
  end if;

  update bookings
     set status = 'cancelled'
   where group_id = p_group
     and status in ('pending', 'approved');

  if not found then
    raise exception 'NOT_CANCELLABLE';
  end if;
end $$;

create function add_holiday(
  p_day date,
  p_period smallint,
  p_reason text,
  p_confirm boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_count int;
  v_id uuid;
begin
  if not is_manager() then
    raise exception 'FORBIDDEN';
  end if;

  if p_period is not null and not exists (select 1 from periods where n = p_period) then
    raise exception 'PERIODS';
  end if;

  select count(*) into v_count
  from bookings b
  where b.day = p_day
    and b.status in ('pending', 'approved')
    and (p_period is null or b.period = p_period);

  if v_count > 0 and not coalesce(p_confirm, false) then
    return jsonb_build_object('needs_confirm', true, 'count', v_count);
  end if;

  insert into holidays (day, period, reason, created_by)
  values (p_day, p_period, nullif(btrim(coalesce(p_reason, '')), ''), (me()).id)
  returning id into v_id;

  if v_count > 0 then
    update bookings b
       set status = 'cancelled'
     where b.day = p_day
       and b.status in ('pending', 'approved')
       and (p_period is null or b.period = p_period);
  end if;

  insert into audit_log (actor, action, details)
  values (
    (me()).id,
    'holiday',
    jsonb_build_object('day', p_day, 'period', p_period, 'cancelled', v_count, 'id', v_id)
  );

  return jsonb_build_object('needs_confirm', false, 'id', v_id, 'cancelled', v_count);
end $$;
