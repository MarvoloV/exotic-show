-- Operator-only batch. Read README.md and pause all code allocations first.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.participants in share row exclusive mode;

create temp table participant_batch (
  code text primary key,
  full_name text not null,
  paid_amount numeric not null
) on commit drop;

insert into pg_temp.participant_batch (code, full_name, paid_amount) values
  ('EX001', 'MARIA GRACIA CORDOVA', 80),
  ('EX002', 'JESSICA JAULES', 80),
  ('EX003', 'LUIS MIGUEL AGURTO', 80),
  ('EX004', 'RENZO ZERGA', 80),
  ('EX005', 'MICHEL ACOSTA', 80),
  ('EX006', 'JOSE ANTONIO GUZMAN', 80),
  ('EX007', 'SANDRO ANGULO CCAHUANA', 80),
  ('EX008', 'DIEGO TORRES', 80),
  ('EX009', 'JENNY CANCHARI', 70),
  ('EX010', 'DAYANNA MEJIA', 70),
  ('EX011', 'SUSAN GALINDO', 70),
  ('EX012', 'PEDRO CASTRO', 80),
  ('EX013', 'KATHERINE NUÑEZ', 80),
  ('EX014', 'YERALDIN PEREZ', 80),
  ('EX015', 'VIKTORYIA PIATLISKAYA', 80),
  ('EX016', 'PEDRO REGIFO', 80),
  ('EX017', 'EUSKADY AYO', 80),
  ('EX018', 'VANESSA LEON VELARDE', 80),
  ('EX019', 'IRENE CRITOBAL', 70),
  ('EX020', 'MARÍA A. VILLANUEVA', 80),
  ('EX021', 'TRACY BLANCO', 80),
  ('EX022', 'MARIELA SALGADO', 70),
  ('EX023', 'MARICIELO INFANTE', 80),
  ('EX024', 'PATRICIA ANTO', 80),
  ('EX025', 'JOEL HINOJOSA', 80),
  ('EX026', 'ARLEEN GRATEROL', 80);

do $$
declare
  cfg record;
  last_number bigint;
  called boolean;
  original_next numeric;
  max_code numeric;
  target_next numeric;
begin
  if (select count(*) <> 26 or sum(paid_amount) <> 2030
      or count(*) filter (where paid_amount = 80) <> 21
      or count(*) filter (where paid_amount = 70) <> 5
      or bool_or(code !~ '^EX[0-9]{3}$' or full_name <> btrim(full_name)
                 or char_length(full_name) not between 1 and 200)
      from pg_temp.participant_batch)
     or exists (select 1 from generate_series(1, 26) n
                where not exists (select 1 from pg_temp.participant_batch b
                                  where b.code = 'EX' || lpad(n::text, 3, '0'))) then
    raise exception 'Invalid batch';
  end if;

  if exists (select 1 from public.participants p
             join pg_temp.participant_batch b on b.code = p.code) then
    raise exception 'Participant code collision; batch not imported';
  end if;

  select seqincrement, seqcache, seqcycle, seqmin, seqmax into strict cfg
  from pg_catalog.pg_sequence where seqrelid = 'public.participant_code_seq'::regclass;
  if cfg.seqincrement <> 1 or cfg.seqcache <> 1 or cfg.seqcycle
     or cfg.seqmin > 1 or cfg.seqmax < 27 then
    raise exception 'Unsupported participant sequence configuration';
  end if;

  -- Transactional sequence lock, without a configuration change. Operators must
  -- pause direct nextval/RPC consumers and maintenance before running this file.
  alter sequence public.participant_code_seq increment by 1;
  select last_value, is_called into strict last_number, called
  from public.participant_code_seq;
  original_next := last_number::numeric + case when called then 1 else 0 end;
  select greatest(26::numeric, coalesce(max(substring(code from 3)::numeric), 0))
    into max_code from public.participants;
  target_next := greatest(original_next, max_code + 1);
  if original_next > cfg.seqmax or target_next > cfg.seqmax
     or target_next < cfg.seqmin then
    raise exception 'Participant sequence exhausted or code exceeds sequence bounds';
  end if;
  if target_next > original_next then
    execute format('alter sequence public.participant_code_seq restart with %s', target_next);
  end if;
end $$;

insert into public.participants (code, full_name, paid_amount)
select code, full_name, paid_amount from pg_temp.participant_batch;

-- Sensitive bearer paths: protect the SQL editor results. Only trust after COMMIT.
select p.code, p.full_name, p.paid_amount, p.attendance_state,
       '/asistencia/' || p.token as attendance_path
from public.participants p
join pg_temp.participant_batch b on b.code = p.code
order by p.code;
commit;
