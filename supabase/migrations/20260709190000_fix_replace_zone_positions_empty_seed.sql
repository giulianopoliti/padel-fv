create or replace function public.replace_zone_positions(
  p_tournament_id uuid,
  p_zone_id uuid,
  p_positions jsonb
)
returns integer
language plpgsql
set search_path to ''
as $function$
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
  from public.zone_couples zc
  where zc.zone_id = p_zone_id;

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
    left join public.zone_couples zc
      on zc.zone_id = p_zone_id
     and zc.couple_id = p.couple_id
    left join public.inscriptions i
      on i.tournament_id = p_tournament_id
     and i.couple_id = p.couple_id
    where p.couple_id is null
       or zc.couple_id is null
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
$function$;
