-- Run only in a disposable local Supabase database after all migrations.
-- This transaction checks authorization, privileges and serial reset/rescan.
-- It does NOT prove concurrent locking; that needs two database connections.
begin;

insert into auth.users (id) values ('11111111-1111-4111-8111-111111111111');
insert into public.approved_administrators (user_id) values ('11111111-1111-4111-8111-111111111111');
insert into public.participants (id, code, token, full_name, paid_amount, attendance_state, attended_at)
values ('22222222-2222-4222-8222-222222222222', 'EX999999999', repeat('a', 64), 'Reset probe', 12.34, 'ASISTIÓ', '2026-03-13 12:00:00+00');

do $$
begin
  if has_function_privilege('anon', 'public.reset_participant_attendance(uuid,timestamptz)', 'execute')
    or not has_function_privilege('authenticated', 'public.reset_participant_attendance(uuid,timestamptz)', 'execute')
    or has_column_privilege('authenticated', 'public.participants', 'attended_at', 'update') then
    raise exception 'unexpected privileges';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
do $$
begin
  begin
    perform public.reset_participant_attendance('22222222-2222-4222-8222-222222222222', '2026-03-13 12:00:00+00');
    raise exception 'unapproved reset succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  if not public.reset_participant_attendance('22222222-2222-4222-8222-222222222222', '2026-03-13 12:00:00+00') then raise exception 'reset failed'; end if;
  if not public.reset_participant_attendance('22222222-2222-4222-8222-222222222222', '2026-03-13 12:00:00+00') then raise exception 'repeat failed'; end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.participants where id = '22222222-2222-4222-8222-222222222222' and attendance_state = 'PENDIENTE' and attended_at is null and code = 'EX999999999' and token = repeat('a', 64) and full_name = 'Reset probe' and paid_amount = 12.34) then raise exception 'reset changed unexpected data'; end if;
end $$;
set local role service_role;
select * from public.record_attendance(repeat('a', 64));
reset role;
set local role authenticated;
do $$
begin
  if public.reset_participant_attendance('22222222-2222-4222-8222-222222222222', '2026-03-13 12:00:00+00') then raise exception 'stale reset succeeded'; end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.participants where id = '22222222-2222-4222-8222-222222222222' and attendance_state = 'ASISTIÓ' and attended_at is not null and attended_at <> '2026-03-13 12:00:00+00') then raise exception 'rescan missing'; end if;
end $$;
rollback;
