begin;

create sequence if not exists public.participant_code_seq;

create or replace function public.next_participant_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n text;
begin
  -- Unapproved users cannot consume participant codes through a direct RPC.
  if not exists (
    select 1 from public.approved_administrators a where a.user_id = auth.uid()
  ) then
    raise insufficient_privilege using message = 'Administrator approval required';
  end if;
  n := nextval('public.participant_code_seq')::text;
  return 'EX' || lpad(n, greatest(3, length(n)), '0');
end;
$$;

-- Membership is provisioned/revoked only by the trusted database operator using
-- an existing auth.users ID. Signing in or editing Auth metadata never approves it.
create table if not exists public.approved_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  code text not null default public.next_participant_code(),
  full_name text not null,
  -- Two independent UUIDv4 values provide 244 random bits without an extension.
  token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  paid_amount numeric(12, 2) not null default 0,
  attendance_state text not null default 'PENDIENTE',
  attended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_code_key unique (code),
  constraint participants_token_key unique (token),
  constraint participants_code_format check (code ~ '^EX[0-9]{3,}$'),
  constraint participants_token_format check (token ~ '^[a-f0-9]{64}$'),
  constraint participants_name_valid check (full_name = btrim(full_name) and char_length(full_name) between 1 and 200),
  constraint participants_payment_valid check (paid_amount between 0 and 9999999999.99),
  constraint participants_attendance_consistent check (
    (attendance_state = 'PENDIENTE' and attended_at is null)
    or (attendance_state = 'ASISTIÓ' and attended_at is not null)
  )
);

-- UNIQUE constraints already create the code/token lookup indexes.
create index if not exists participants_attendance_created_idx
  on public.participants (attendance_state, created_at desc, id);

create or replace function public.touch_participant_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace trigger participants_updated_at
before update on public.participants
for each row execute function public.touch_participant_updated_at();

alter table public.approved_administrators enable row level security;
alter table public.participants enable row level security;

-- RLS also protects direct API calls; proxy/DAL checks are not the data boundary.
-- Self-only membership reads avoid a recursive RLS policy and directory exposure.
drop policy if exists administrators_read_self on public.approved_administrators;
create policy administrators_read_self on public.approved_administrators
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists administrators_manage_participants on public.participants;
create policy administrators_manage_participants on public.participants
for all to authenticated
using (exists (
  select 1 from public.approved_administrators a where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.approved_administrators a where a.user_id = (select auth.uid())
));

revoke all on table public.approved_administrators from public, anon, authenticated, service_role;
revoke all on table public.participants from public, anon, authenticated, service_role;
revoke all on sequence public.participant_code_seq from public, anon, authenticated, service_role;
revoke all on function public.next_participant_code() from public, anon, authenticated, service_role;
revoke all on function public.touch_participant_updated_at() from public, anon, authenticated, service_role;
grant select on table public.approved_administrators to authenticated;
grant select, delete on table public.participants to authenticated;
-- Administrative edits cannot reset attendance or replace immutable QR tokens.
grant insert (full_name, paid_amount), update (full_name, paid_amount)
  on table public.participants to authenticated;
grant execute on function public.next_participant_code() to authenticated;

create or replace function public.record_attendance(attendance_token text)
returns table (outcome text, full_name text, attended_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant public.participants%rowtype;
begin
  if attendance_token is null or attendance_token !~ '^[a-f0-9]{64}$' then
    return query select 'invalid'::text, null::text, null::timestamptz;
    return;
  end if;

  select p.* into participant from public.participants p
  where p.token = attendance_token
  for update;

  if not found then
    return query select 'invalid'::text, null::text, null::timestamptz;
  elsif participant.attended_at is not null then
    return query select 'already_recorded'::text, participant.full_name, participant.attended_at;
  else
    update public.participants p
    set attendance_state = 'ASISTIÓ', attended_at = clock_timestamp()
    where p.id = participant.id
    returning p.* into participant;
    return query select 'recorded'::text, participant.full_name, participant.attended_at;
  end if;
end;
$$;

-- Only the server attendance DAL holds this role. SECURITY DEFINER permits that
-- single operation without granting the service role table access. Empty search
-- paths and qualified names prevent object-shadowing attacks. timestamptz stores
-- instants; America/Lima formatting belongs exclusively to presentation.
revoke all on function public.record_attendance(text) from public, anon, authenticated;
grant execute on function public.record_attendance(text) to service_role;

commit;
