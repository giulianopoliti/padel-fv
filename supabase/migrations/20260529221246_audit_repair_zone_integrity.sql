create schema if not exists maintenance;

revoke all on schema maintenance from public;

create table if not exists maintenance.zone_integrity_repair_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  repair_name text not null,
  finding_type text not null,
  tournament_id uuid,
  zone_id uuid,
  couple_id uuid,
  row_count integer,
  details jsonb not null default '{}'::jsonb
);

insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  zone_id,
  couple_id,
  row_count,
  details
)
select
  'audit_repair_zone_integrity',
  'zone_positions_duplicate_group',
  tournament_id,
  zone_id,
  couple_id,
  count(*)::integer,
  jsonb_build_object(
    'zone_position_ids',
    jsonb_agg(id order by is_definitive desc, updated_at desc nulls last, calculated_at desc nulls last, created_at desc nulls last, id)
  )
from public.zone_positions
where tournament_id is not null
  and zone_id is not null
  and couple_id is not null
group by tournament_id, zone_id, couple_id
having count(*) > 1;

insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  zone_id,
  couple_id,
  row_count,
  details
)
select
  'audit_repair_zone_integrity',
  'zone_positions_without_inscription',
  zp.tournament_id,
  zp.zone_id,
  zp.couple_id,
  1,
  to_jsonb(zp)
from public.zone_positions zp
left join public.inscriptions i
  on i.tournament_id = zp.tournament_id
 and i.couple_id = zp.couple_id
where i.id is null;

insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  zone_id,
  couple_id,
  row_count,
  details
)
select
  'audit_repair_zone_integrity',
  'zone_couples_without_inscription',
  z.tournament_id,
  zc.zone_id,
  zc.couple_id,
  1,
  to_jsonb(zc)
from public.zone_couples zc
join public.zones z on z.id = zc.zone_id
left join public.inscriptions i
  on i.tournament_id = z.tournament_id
 and i.couple_id = zc.couple_id
where i.id is null;

insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  zone_id,
  couple_id,
  row_count,
  details
)
select
  'audit_repair_zone_integrity',
  'zone_couples_without_zone_positions',
  z.tournament_id,
  zc.zone_id,
  zc.couple_id,
  1,
  jsonb_build_object('zone_couples_created_at', zc.created_at)
from public.zone_couples zc
join public.zones z on z.id = zc.zone_id
join public.inscriptions i
  on i.tournament_id = z.tournament_id
 and i.couple_id = zc.couple_id
left join public.zone_positions zp
  on zp.tournament_id = z.tournament_id
 and zp.zone_id = zc.zone_id
 and zp.couple_id = zc.couple_id
where zp.id is null;

insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  zone_id,
  couple_id,
  row_count,
  details
)
select
  'audit_repair_zone_integrity',
  'zone_positions_without_zone_couples',
  zp.tournament_id,
  zp.zone_id,
  zp.couple_id,
  1,
  jsonb_build_object(
    'zone_position_id', zp.id,
    'note', 'zone_positions is canonical; this finding is audit-only when inscription is valid'
  )
from public.zone_positions zp
join public.inscriptions i
  on i.tournament_id = zp.tournament_id
 and i.couple_id = zp.couple_id
left join public.zone_couples zc
  on zc.zone_id = zp.zone_id
 and zc.couple_id = zp.couple_id
where zc.zone_id is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by tournament_id, zone_id, couple_id
      order by
        is_definitive desc nulls last,
        updated_at desc nulls last,
        calculated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as rn
  from public.zone_positions
  where tournament_id is not null
    and zone_id is not null
    and couple_id is not null
)
delete from public.zone_positions zp
using ranked r
where zp.id = r.id
  and r.rn > 1;

delete from public.zone_positions zp
where not exists (
  select 1
  from public.inscriptions i
  where i.tournament_id = zp.tournament_id
    and i.couple_id = zp.couple_id
);

delete from public.zone_couples zc
using public.zones z
where z.id = zc.zone_id
  and not exists (
    select 1
    from public.inscriptions i
    where i.tournament_id = z.tournament_id
      and i.couple_id = zc.couple_id
  )
  and not exists (
    select 1
    from public.matches m
    where m.tournament_id = z.tournament_id
      and (m.zone_id = z.id or m.type = 'ELIMINATION')
      and (m.couple1_id = zc.couple_id or m.couple2_id = zc.couple_id)
  )
  and not exists (
    select 1
    from public.tournament_couple_seeds tcs
    where tcs.tournament_id = z.tournament_id
      and tcs.couple_id = zc.couple_id
  );

with missing as (
  select
    z.tournament_id,
    zc.zone_id,
    zc.couple_id,
    row_number() over (
      partition by zc.zone_id
      order by zc.created_at, zc.couple_id
    ) as rn
  from public.zone_couples zc
  join public.zones z on z.id = zc.zone_id
  join public.inscriptions i
    on i.tournament_id = z.tournament_id
   and i.couple_id = zc.couple_id
  left join public.zone_positions zp
    on zp.tournament_id = z.tournament_id
   and zp.zone_id = zc.zone_id
   and zp.couple_id = zc.couple_id
  where zp.id is null
),
zone_position_max as (
  select
    zone_id,
    coalesce(max(position), 0) as max_position
  from public.zone_positions
  group by zone_id
)
insert into public.zone_positions (
  tournament_id,
  zone_id,
  couple_id,
  position,
  is_definitive,
  points,
  wins,
  losses,
  games_for,
  games_against,
  games_difference,
  player_score_total,
  calculated_at,
  sets_for,
  sets_against,
  sets_difference,
  created_at,
  updated_at
)
select
  m.tournament_id,
  m.zone_id,
  m.couple_id,
  coalesce(zpm.max_position, 0) + m.rn,
  false,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  now(),
  0,
  0,
  0,
  now(),
  now()
from missing m
left join zone_position_max zpm on zpm.zone_id = m.zone_id;
