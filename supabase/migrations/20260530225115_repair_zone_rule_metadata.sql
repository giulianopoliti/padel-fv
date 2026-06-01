/* create schema if not exists maintenance;

create table if not exists maintenance.zone_integrity_repair_audit (
  id uuid primary key default gen_random_uuid(),
  audit_type text not null,
  tournament_id uuid,
  zone_id uuid,
  couple_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

with zone_position_counts as (
  select
    zone_id,
    count(distinct couple_id)::integer as couple_count
  from public.zone_positions
  group by zone_id
),
legacy_zone_couple_counts as (
  select
    zone_id,
    count(distinct couple_id)::integer as couple_count
  from public.zone_couples
  group by zone_id
),
zone_counts as (
  select
    z.id as zone_id,
    z.tournament_id,
    coalesce(zpc.couple_count, lzcc.couple_count, 0)::integer as couple_count,
    case
      when zpc.couple_count is not null then 'zone_positions'
      when lzcc.couple_count is not null then 'zone_couples'
      else 'empty'
    end as count_source
  from public.zones z
  left join zone_position_counts zpc on zpc.zone_id = z.id
  left join legacy_zone_couple_counts lzcc on lzcc.zone_id = z.id
),
expected_rules as (
  select
    z.id as zone_id,
    z.tournament_id,
    z.capacity as old_capacity,
    z.max_couples as old_max_couples,
    z.rounds_per_couple as old_rounds_per_couple,
    zc.couple_count,
    zc.count_source,
    zc.couple_count as new_capacity,
    coalesce(
      nullif(t.format_config #>> '{zoneRules,maxSize}', '')::integer,
      greatest(coalesce(z.max_couples, 0), coalesce(z.capacity, 0), zc.couple_count)
    ) as new_max_couples,
    case
      when zc.couple_count < 2 then null
      when t.format_config ->> 'baseType' = 'AMERICAN' and zc.couple_count = 2 then 1
      when t.format_config ->> 'baseType' = 'AMERICAN'
        and t.format_config ->> 'zoneMode' = 'MULTI_ZONE'
        and nullif(t.format_config ->> 'targetMatchesPerCouple', '')::integer = 3
        and zc.couple_count = 3 then 2
      when t.format_config ->> 'zoneStage' = 'ROUND_ROBIN' then greatest(zc.couple_count - 1, 0)
      else nullif(t.format_config ->> 'targetMatchesPerCouple', '')::integer
    end as new_rounds_per_couple
  from public.zones z
  join zone_counts zc on zc.zone_id = z.id
  join public.tournaments t on t.id = z.tournament_id
  where t.format_config ->> 'version' = '2'
),
changed_rules as (
  select *
  from expected_rules
  where
    old_capacity is distinct from new_capacity
    or old_max_couples is distinct from new_max_couples
    or old_rounds_per_couple is distinct from new_rounds_per_couple
),
audit as (
  insert into maintenance.zone_integrity_repair_audit (
    audit_type,
    tournament_id,
    zone_id,
    details
  )
  select
    'repair_zone_rule_metadata',
    tournament_id,
    zone_id,
    jsonb_build_object(
      'count_source', count_source,
      'couple_count', couple_count,
      'old', jsonb_build_object(
        'capacity', old_capacity,
        'max_couples', old_max_couples,
        'rounds_per_couple', old_rounds_per_couple
      ),
      'new', jsonb_build_object(
        'capacity', new_capacity,
        'max_couples', new_max_couples,
        'rounds_per_couple', new_rounds_per_couple
      )
    )
  from changed_rules
  returning zone_id
)
update public.zones z
set
  capacity = cr.new_capacity,
  max_couples = cr.new_max_couples,
  rounds_per_couple = cr.new_rounds_per_couple
from changed_rules cr
where z.id = cr.zone_id;
 */