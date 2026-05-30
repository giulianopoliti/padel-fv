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

with artifact_counts as (
  select
    t.id as tournament_id,
    count(distinct tcs.id) as seed_count,
    count(distinct m.id) as match_count,
    count(distinct mh.id) as hierarchy_count,
    min(coalesce(m.created_at, mh.created_at, t.created_at)) as first_artifact_at
  from public.tournaments t
  left join public.tournament_couple_seeds tcs on tcs.tournament_id = t.id
  left join public.matches m
    on m.tournament_id = t.id
   and m.type = 'ELIMINATION'
  left join public.match_hierarchy mh on mh.tournament_id = t.id
  group by t.id
),
with_artifacts as (
  select *
  from artifact_counts
  where seed_count > 0
     or match_count > 0
     or hierarchy_count > 0
)
insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  row_count,
  details
)
select
  'normalize_bracket_state',
  'bracket_artifacts_missing_generated_at',
  t.id,
  (wa.seed_count + wa.match_count + wa.hierarchy_count)::integer,
  jsonb_build_object(
    'seed_count', wa.seed_count,
    'match_count', wa.match_count,
    'hierarchy_count', wa.hierarchy_count,
    'first_artifact_at', wa.first_artifact_at
  )
from public.tournaments t
join with_artifacts wa on wa.tournament_id = t.id
where t.bracket_generated_at is null;

with artifact_counts as (
  select
    t.id as tournament_id,
    count(distinct tcs.id) as seed_count,
    count(distinct m.id) as match_count,
    count(distinct mh.id) as hierarchy_count
  from public.tournaments t
  left join public.tournament_couple_seeds tcs on tcs.tournament_id = t.id
  left join public.matches m
    on m.tournament_id = t.id
   and m.type = 'ELIMINATION'
  left join public.match_hierarchy mh on mh.tournament_id = t.id
  group by t.id
)
insert into maintenance.zone_integrity_repair_audit (
  repair_name,
  finding_type,
  tournament_id,
  row_count,
  details
)
select
  'normalize_bracket_state',
  'bracket_status_generated_without_artifacts',
  t.id,
  0,
  jsonb_build_object(
    'bracket_status', t.bracket_status,
    'bracket_generated_at', t.bracket_generated_at
  )
from public.tournaments t
join artifact_counts ac on ac.tournament_id = t.id
where t.bracket_status in ('BRACKET_GENERATED', 'BRACKET_ACTIVE')
  and ac.seed_count = 0
  and ac.match_count = 0
  and ac.hierarchy_count = 0;

with artifact_counts as (
  select
    t.id as tournament_id,
    count(distinct tcs.id) as seed_count,
    count(distinct m.id) as match_count,
    count(distinct mh.id) as hierarchy_count,
    min(coalesce(m.created_at, mh.created_at, t.created_at)) as first_artifact_at
  from public.tournaments t
  left join public.tournament_couple_seeds tcs on tcs.tournament_id = t.id
  left join public.matches m
    on m.tournament_id = t.id
   and m.type = 'ELIMINATION'
  left join public.match_hierarchy mh on mh.tournament_id = t.id
  group by t.id
)
update public.tournaments t
set bracket_generated_at = coalesce(ac.first_artifact_at, now())
from artifact_counts ac
where ac.tournament_id = t.id
  and t.bracket_generated_at is null
  and (ac.seed_count > 0 or ac.match_count > 0 or ac.hierarchy_count > 0);

with artifact_counts as (
  select
    t.id as tournament_id,
    count(distinct tcs.id) as seed_count,
    count(distinct m.id) as match_count,
    count(distinct mh.id) as hierarchy_count
  from public.tournaments t
  left join public.tournament_couple_seeds tcs on tcs.tournament_id = t.id
  left join public.matches m
    on m.tournament_id = t.id
   and m.type = 'ELIMINATION'
  left join public.match_hierarchy mh on mh.tournament_id = t.id
  group by t.id
)
update public.tournaments t
set bracket_status = 'BRACKET_GENERATED'
from artifact_counts ac
where ac.tournament_id = t.id
  and t.bracket_status = 'NOT_STARTED'
  and (ac.seed_count > 0 or ac.match_count > 0 or ac.hierarchy_count > 0);
