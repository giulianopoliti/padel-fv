create schema if not exists private;

create schema if not exists maintenance;

revoke all on schema private from public;
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

create or replace view maintenance.zone_integrity_findings as
select
  'zone_couple_without_inscription'::text as finding_type,
  z.tournament_id,
  zc.zone_id,
  zc.couple_id,
  null::integer as position,
  jsonb_build_object('zone_couple_created_at', zc.created_at) as details
from public.zone_couples zc
join public.zones z on z.id = zc.zone_id
left join public.inscriptions i
  on i.tournament_id = z.tournament_id
 and i.couple_id = zc.couple_id
where i.id is null

union all

select
  'zone_couple_without_position'::text,
  z.tournament_id,
  zc.zone_id,
  zc.couple_id,
  null::integer,
  '{}'::jsonb
from public.zone_couples zc
join public.zones z on z.id = zc.zone_id
left join public.zone_positions zp
  on zp.tournament_id = z.tournament_id
 and zp.zone_id = zc.zone_id
 and zp.couple_id = zc.couple_id
where zp.id is null

union all

select
  'position_without_zone_couple'::text,
  zp.tournament_id,
  zp.zone_id,
  zp.couple_id,
  zp.position,
  '{}'::jsonb
from public.zone_positions zp
left join public.zone_couples zc
  on zc.zone_id = zp.zone_id
 and zc.couple_id = zp.couple_id
where zc.couple_id is null

union all

select
  'duplicate_position'::text,
  min(zp.tournament_id::text)::uuid,
  zp.zone_id,
  null::uuid,
  zp.position,
  jsonb_build_object('row_count', count(*))
from public.zone_positions zp
group by zp.zone_id, zp.position
having count(*) > 1;

revoke all on maintenance.zone_integrity_findings from public;

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
  'harden_zone_membership_and_atomic_positions',
  'zone_couple_without_inscription',
  z.tournament_id,
  zc.zone_id,
  zc.couple_id,
  1,
  jsonb_build_object(
    'zone_couple_created_at', zc.created_at,
    'matches', (
      select count(*)
      from public.matches m
      where m.tournament_id = z.tournament_id
        and (m.couple1_id = zc.couple_id or m.couple2_id = zc.couple_id)
    )
  )
from public.zone_couples zc
join public.zones z on z.id = zc.zone_id
left join public.inscriptions i
  on i.tournament_id = z.tournament_id
 and i.couple_id = zc.couple_id
where i.id is null;

delete from public.zone_couples zc
using public.zones z
where z.id = zc.zone_id
  and exists (
    select 1
    from public.tournaments t
    where t.id = z.tournament_id
      and t.status not in (
        'CANCELED',
        'FINISHED',
        'FINISHED_POINTS_PENDING',
        'FINISHED_POINTS_CALCULATED'
      )
  )
  and not exists (
    select 1
    from public.inscriptions i
    where i.tournament_id = z.tournament_id
      and i.couple_id = zc.couple_id
  );

with missing as (
  select
    z.tournament_id,
    zc.zone_id,
    zc.couple_id,
    row_number() over (
      partition by zc.zone_id
      order by zc.created_at, zc.couple_id
    ) as missing_position
  from public.zone_couples zc
  join public.zones z on z.id = zc.zone_id
  join public.tournaments t on t.id = z.tournament_id
  join public.inscriptions i
    on i.tournament_id = z.tournament_id
   and i.couple_id = zc.couple_id
  left join public.zone_positions zp
    on zp.tournament_id = z.tournament_id
   and zp.zone_id = zc.zone_id
   and zp.couple_id = zc.couple_id
  where zp.id is null
    and t.status not in (
      'CANCELED',
      'FINISHED',
      'FINISHED_POINTS_PENDING',
      'FINISHED_POINTS_CALCULATED'
    )
),
zone_max as (
  select zone_id, coalesce(max(position), 0) as max_position
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
  sets_for,
  sets_against,
  sets_difference,
  calculated_at
)
select
  m.tournament_id,
  m.zone_id,
  m.couple_id,
  coalesce(zm.max_position, 0) + m.missing_position,
  false,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  now()
from missing m
left join zone_max zm on zm.zone_id = m.zone_id;

create or replace function private.validate_zone_couple_inscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  select z.tournament_id
  into v_tournament_id
  from public.zones z
  where z.id = new.zone_id;

  if v_tournament_id is null then
    raise exception using
      errcode = '23503',
      message = 'zone_couples.zone_id does not reference a tournament zone';
  end if;

  if not exists (
    select 1
    from public.inscriptions i
    where i.tournament_id = v_tournament_id
      and i.couple_id = new.couple_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'zone couple requires a matching tournament inscription';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_zone_couple_inscription() from public;

drop trigger if exists validate_zone_couple_inscription on public.zone_couples;
create trigger validate_zone_couple_inscription
before insert or update of zone_id, couple_id
on public.zone_couples
for each row
execute function private.validate_zone_couple_inscription();

create or replace function private.cleanup_zone_membership_before_inscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.couple_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.tournament_id is not distinct from new.tournament_id
     and old.couple_id is not distinct from new.couple_id then
    return new;
  end if;

  delete from public.zone_positions zp
  where zp.tournament_id = old.tournament_id
    and zp.couple_id = old.couple_id;

  delete from public.zone_couples zc
  using public.zones z
  where z.id = zc.zone_id
    and z.tournament_id = old.tournament_id
    and zc.couple_id = old.couple_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.cleanup_zone_membership_before_inscription_change() from public;

drop trigger if exists cleanup_zone_membership_before_inscription_change on public.inscriptions;
create trigger cleanup_zone_membership_before_inscription_change
before delete or update of tournament_id, couple_id
on public.inscriptions
for each row
execute function private.cleanup_zone_membership_before_inscription_change();

create or replace function public.apply_zone_membership_changes(
  p_tournament_id uuid,
  p_changes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_change_count integer;
  v_inserted_count integer := 0;
begin
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'p_changes must be a JSON array';
  end if;

  select jsonb_array_length(p_changes) into v_change_count;

  if v_change_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'p_changes must contain at least one membership change';
  end if;

  if (
    select count(distinct (item ->> 'couple_id')::uuid)
    from jsonb_array_elements(p_changes) item
  ) <> v_change_count then
    raise exception using
      errcode = '23505',
      message = 'p_changes contains duplicate couples';
  end if;

  if exists (
    with changes as (
      select *
      from jsonb_to_recordset(p_changes) as change (
        couple_id uuid,
        from_zone_id uuid,
        to_zone_id uuid,
        to_position integer
      )
    )
    select 1
    from changes change
    where change.couple_id is null
       or (change.from_zone_id is null and change.to_zone_id is null)
       or (change.to_zone_id is not null and coalesce(change.to_position, 0) < 1)
  ) then
    raise exception using
      errcode = '22023',
      message = 'membership change contains invalid values';
  end if;

  if exists (
    with changes as (
      select *
      from jsonb_to_recordset(p_changes) as change (
        couple_id uuid,
        from_zone_id uuid,
        to_zone_id uuid,
        to_position integer
      )
    ), referenced_zones as (
      select from_zone_id as zone_id from changes where from_zone_id is not null
      union
      select to_zone_id from changes where to_zone_id is not null
    )
    select 1
    from referenced_zones rz
    left join public.zones z
      on z.id = rz.zone_id
     and z.tournament_id = p_tournament_id
    where z.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'membership change references a zone outside the tournament';
  end if;

  if exists (
    with changes as (
      select *
      from jsonb_to_recordset(p_changes) as change (
        couple_id uuid,
        from_zone_id uuid,
        to_zone_id uuid,
        to_position integer
      )
    )
    select 1
    from changes change
    left join public.inscriptions i
      on i.tournament_id = p_tournament_id
     and i.couple_id = change.couple_id
    where change.to_zone_id is not null
      and i.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'target couple does not have a valid tournament inscription';
  end if;

  if exists (
    with changes as (
      select *
      from jsonb_to_recordset(p_changes) as change (
        couple_id uuid,
        from_zone_id uuid,
        to_zone_id uuid,
        to_position integer
      )
    )
    select 1
    from changes change
    left join public.zone_positions zp
      on zp.tournament_id = p_tournament_id
     and zp.zone_id = change.from_zone_id
     and zp.couple_id = change.couple_id
    where change.from_zone_id is not null
      and zp.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'source membership does not exist';
  end if;

  if exists (
    with changes as (
      select *
      from jsonb_to_recordset(p_changes) as change (
        couple_id uuid,
        from_zone_id uuid,
        to_zone_id uuid,
        to_position integer
      )
    )
    select 1
    from changes change
    join public.zone_positions zp
      on zp.tournament_id = p_tournament_id
     and zp.couple_id = change.couple_id
    where change.to_zone_id is not null
      and zp.zone_id is distinct from change.from_zone_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'target couple already belongs to another tournament zone';
  end if;

  with changes as (
    select *
    from jsonb_to_recordset(p_changes) as change (
      couple_id uuid,
      from_zone_id uuid,
      to_zone_id uuid,
      to_position integer
    )
  )
  delete from public.zone_couples zc
  using changes change
  where change.from_zone_id is not null
    and zc.zone_id = change.from_zone_id
    and zc.couple_id = change.couple_id;

  with changes as (
    select *
    from jsonb_to_recordset(p_changes) as change (
      couple_id uuid,
      from_zone_id uuid,
      to_zone_id uuid,
      to_position integer
    )
  )
  delete from public.zone_positions zp
  using changes change
  where change.from_zone_id is not null
    and zp.tournament_id = p_tournament_id
    and zp.zone_id = change.from_zone_id
    and zp.couple_id = change.couple_id;

  with changes as (
    select *
    from jsonb_to_recordset(p_changes) as change (
      couple_id uuid,
      from_zone_id uuid,
      to_zone_id uuid,
      to_position integer
    )
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
    sets_for,
    sets_against,
    sets_difference,
    calculated_at
  )
  select
    p_tournament_id,
    change.to_zone_id,
    change.couple_id,
    change.to_position,
    false,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    now()
  from changes change
  where change.to_zone_id is not null;

  get diagnostics v_inserted_count = row_count;

  with changes as (
    select *
    from jsonb_to_recordset(p_changes) as change (
      couple_id uuid,
      from_zone_id uuid,
      to_zone_id uuid,
      to_position integer
    )
  )
  insert into public.zone_couples (zone_id, couple_id)
  select change.to_zone_id, change.couple_id
  from changes change
  where change.to_zone_id is not null;

  return v_inserted_count;
end;
$$;

revoke all on function public.apply_zone_membership_changes(uuid, jsonb) from anon, authenticated, public;
grant execute on function public.apply_zone_membership_changes(uuid, jsonb) to service_role;

comment on function public.apply_zone_membership_changes(uuid, jsonb) is
  'Atomically adds, moves, swaps, or removes canonical and mirrored zone memberships.';

create or replace function public.replace_zone_positions(
  p_tournament_id uuid,
  p_zone_id uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payload_count integer;
  v_membership_count integer;
  v_inserted_count integer;
begin
  if jsonb_typeof(p_positions) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'p_positions must be a JSON array';
  end if;

  if not exists (
    select 1
    from public.zones z
    where z.id = p_zone_id
      and z.tournament_id = p_tournament_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'zone does not belong to tournament';
  end if;

  select jsonb_array_length(p_positions)
  into v_payload_count;

  select count(*)
  into v_membership_count
  from public.zone_positions zp
  where zp.tournament_id = p_tournament_id
    and zp.zone_id = p_zone_id;

  if v_payload_count = 0 or v_payload_count <> v_membership_count then
    raise exception using
      errcode = '23514',
      message = format(
        'position payload count (%s) must match canonical membership count (%s)',
        v_payload_count,
        v_membership_count
      );
  end if;

  if exists (
    with payload as (
      select (item ->> 'couple_id')::uuid as couple_id
      from jsonb_array_elements(p_positions) item
    )
    select 1
    from payload p
    left join public.zone_positions zp
      on zp.tournament_id = p_tournament_id
     and zp.zone_id = p_zone_id
     and zp.couple_id = p.couple_id
    left join public.inscriptions i
      on i.tournament_id = p_tournament_id
     and i.couple_id = p.couple_id
    where p.couple_id is null
       or zp.id is null
       or i.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'position payload contains a non-member or unregistered couple';
  end if;

  if (
    select count(distinct (item ->> 'couple_id')::uuid)
    from jsonb_array_elements(p_positions) item
  ) <> v_payload_count then
    raise exception using
      errcode = '23505',
      message = 'position payload contains duplicate couples';
  end if;

  delete from public.zone_positions zp
  where zp.tournament_id = p_tournament_id
    and zp.zone_id = p_zone_id;

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
    tie_info,
    calculated_at,
    sets_for,
    sets_against,
    sets_difference,
    updated_at
  )
  select
    p_tournament_id,
    p_zone_id,
    payload.couple_id,
    payload.position,
    coalesce(payload.is_definitive, false),
    coalesce(payload.points, 0),
    coalesce(payload.wins, 0),
    coalesce(payload.losses, 0),
    coalesce(payload.games_for, 0),
    coalesce(payload.games_against, 0),
    coalesce(payload.games_difference, 0),
    coalesce(payload.player_score_total, 0),
    payload.tie_info,
    coalesce(payload.calculated_at, now()),
    coalesce(payload.sets_for, 0),
    coalesce(payload.sets_against, 0),
    coalesce(payload.sets_difference, 0),
    now()
  from jsonb_to_recordset(p_positions) as payload (
    couple_id uuid,
    position integer,
    is_definitive boolean,
    points integer,
    wins integer,
    losses integer,
    games_for integer,
    games_against integer,
    games_difference integer,
    player_score_total integer,
    tie_info text,
    calculated_at timestamptz,
    sets_for smallint,
    sets_against smallint,
    sets_difference smallint
  );

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.replace_zone_positions(uuid, uuid, jsonb) from public;
grant execute on function public.replace_zone_positions(uuid, uuid, jsonb) to authenticated;
grant execute on function public.replace_zone_positions(uuid, uuid, jsonb) to service_role;

comment on function public.replace_zone_positions(uuid, uuid, jsonb) is
  'Atomically validates and replaces all calculated positions for one tournament zone.';
