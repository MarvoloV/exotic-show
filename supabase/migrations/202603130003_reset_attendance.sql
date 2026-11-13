begin;

-- Only an approved administrator can clear one particular attendance instant.
-- The row lock is the same lock taken by record_attendance, so an old form
-- cannot clear a later scan even when reset and scan run concurrently.
create or replace function public.reset_participant_attendance(participant_id uuid, expected_attended_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant public.participants%rowtype;
begin
  if not exists (select 1 from public.approved_administrators a where a.user_id = auth.uid()) then
    raise insufficient_privilege using message = 'Administrator approval required';
  end if;
  if participant_id is null or expected_attended_at is null then
    return false;
  end if;
  select p.* into participant from public.participants p
  where p.id = participant_id
  for update;
  if not found then
    return false;
  end if;
  if participant.attendance_state = 'PENDIENTE' then
    return true;
  end if;
  if participant.attended_at is distinct from expected_attended_at then
    return false;
  end if;
  update public.participants p
  set attendance_state = 'PENDIENTE', attended_at = null
  where p.id = participant.id;
  return true;
end;
$$;

revoke all on function public.reset_participant_attendance(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.reset_participant_attendance(uuid, timestamptz) to authenticated;

commit;
