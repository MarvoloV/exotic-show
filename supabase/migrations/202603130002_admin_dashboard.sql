begin;

-- Global aggregates run under the caller's JWT and participants RLS, not an
-- owner/service role. Return NUMERIC totals as text to preserve every cent.
create or replace function public.admin_dashboard_metrics()
returns table (
  registered text, attended text, pending text,
  paid_total text, attendance_percentage text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.approved_administrators a where a.user_id = auth.uid()
  ) then
    raise insufficient_privilege using message = 'Administrator approval required';
  end if;

  return query
  select
    count(*)::text,
    (count(*) filter (where p.attendance_state = 'ASISTIÓ'))::text,
    (count(*) filter (where p.attendance_state = 'PENDIENTE'))::text,
    round(coalesce(sum(p.paid_amount), 0), 2)::text,
    coalesce(round(
      100.0 * count(*) filter (where p.attendance_state = 'ASISTIÓ')
      / nullif(count(*), 0), 1
    ), 0.0)::text
  from public.participants p;
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public, anon, authenticated, service_role;
grant execute on function public.admin_dashboard_metrics() to authenticated;

commit;
