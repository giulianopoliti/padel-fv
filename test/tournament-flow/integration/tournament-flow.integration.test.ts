jest.mock('@/app/api/tournaments/actions', () => ({
  advanceWinnerUsingHierarchy: jest.fn(async () => ({ success: true, message: 'advanced' })),
}))

import {
  ensureCanonicalZoneMembership,
  removeTournamentCoupleMembership,
} from '@/lib/services/tournament-zone-membership'
import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'
import { ZoneRulesSyncService } from '@/lib/services/zone-rules-sync.service'
import { generateBracketFromSeeding } from '@/utils/bracket-generator-core'
import {
  canUseLocalSupabaseDb,
  createPsqlSupabaseClient,
  execSql,
  readJson,
} from './psql-supabase-client'

const describeDb = canUseLocalSupabaseDb() ? describe : describe.skip

const ids = {
  club: '11111111-1111-1111-1111-111111111111',
  tournamentLong: '22222222-2222-2222-2222-222222222222',
  tournamentAmerican: '22222222-2222-2222-2222-222222222223',
  zoneLong: '33333333-3333-3333-3333-333333333331',
  zoneAmerican: '33333333-3333-3333-3333-333333333332',
  zoneAmericanB: '33333333-3333-3333-3333-333333333333',
  players: [
    '44444444-4444-4444-4444-444444444441',
    '44444444-4444-4444-4444-444444444442',
    '44444444-4444-4444-4444-444444444443',
    '44444444-4444-4444-4444-444444444444',
    '44444444-4444-4444-4444-444444444445',
    '44444444-4444-4444-4444-444444444446',
    '44444444-4444-4444-4444-444444444447',
    '44444444-4444-4444-4444-444444444448',
  ],
  couples: [
    '55555555-5555-5555-5555-555555555551',
    '55555555-5555-5555-5555-555555555552',
    '55555555-5555-5555-5555-555555555553',
    '55555555-5555-5555-5555-555555555554',
  ],
}

const cleanupSql = `
  delete from public.match_hierarchy where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.matches where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.tournament_couple_seeds where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.zone_positions where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.zone_couples where zone_id in ('${ids.zoneLong}', '${ids.zoneAmerican}', '${ids.zoneAmericanB}');
  delete from public.inscriptions where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.zones where tournament_id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.tournaments where id in ('${ids.tournamentLong}', '${ids.tournamentAmerican}');
  delete from public.couples where id in (${ids.couples.map((id) => `'${id}'`).join(', ')});
  delete from public.players where id in (${ids.players.map((id) => `'${id}'`).join(', ')});
  delete from public.clubes where id = '${ids.club}';
`

const americanMultiZone3ConfigSql = JSON.stringify(getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3')).replace(/'/g, "''")

const seedBaseSql = `
  insert into public.clubes (id, name, is_active)
  values ('${ids.club}', 'Tournament Flow Test Club', true);

  insert into public.players (id, first_name, last_name, gender, score, es_prueba)
  values
    ('${ids.players[0]}', 'Player', 'One', 'MALE', 100, true),
    ('${ids.players[1]}', 'Player', 'Two', 'MALE', 100, true),
    ('${ids.players[2]}', 'Player', 'Three', 'MALE', 100, true),
    ('${ids.players[3]}', 'Player', 'Four', 'MALE', 100, true),
    ('${ids.players[4]}', 'Player', 'Five', 'MALE', 100, true),
    ('${ids.players[5]}', 'Player', 'Six', 'MALE', 100, true),
    ('${ids.players[6]}', 'Player', 'Seven', 'MALE', 100, true),
    ('${ids.players[7]}', 'Player', 'Eight', 'MALE', 100, true);

  insert into public.couples (id, player1_id, player2_id, es_prueba)
  values
    ('${ids.couples[0]}', '${ids.players[0]}', '${ids.players[1]}', true),
    ('${ids.couples[1]}', '${ids.players[2]}', '${ids.players[3]}', true),
    ('${ids.couples[2]}', '${ids.players[4]}', '${ids.players[5]}', true),
    ('${ids.couples[3]}', '${ids.players[6]}', '${ids.players[7]}', true);
`

const seedLongTournamentSql = `
  insert into public.tournaments (id, club_id, name, type, gender, status, es_prueba, bracket_status)
  values ('${ids.tournamentLong}', '${ids.club}', 'Long Tournament Flow Test', 'LONG', 'MALE', 'NOT_STARTED', true, 'NOT_STARTED');

  insert into public.zones (id, tournament_id, name, capacity, es_prueba)
  values ('${ids.zoneLong}', '${ids.tournamentLong}', 'Zona General', 4, true);
`

const seedAmericanTournamentSql = `
  insert into public.tournaments (id, club_id, name, type, gender, status, es_prueba, bracket_status, format_type, format_config)
  values (
    '${ids.tournamentAmerican}',
    '${ids.club}',
    'American Tournament Flow Test',
    'AMERICAN',
    'MALE',
    'NOT_STARTED',
    true,
    'NOT_STARTED',
    'AMERICAN_3',
    '${americanMultiZone3ConfigSql}'::jsonb
  );

  insert into public.zones (id, tournament_id, name, capacity, max_couples, rounds_per_couple, es_prueba)
  values ('${ids.zoneAmerican}', '${ids.tournamentAmerican}', 'Zona A', 3, 3, 2, true);
`

const seedInscriptionsSql = (tournamentId: string, coupleIds = ids.couples) => {
  const contactPlayers = [ids.players[0], ids.players[2], ids.players[4], ids.players[6]]
  const values = coupleIds
    .map((coupleId, index) => `('${contactPlayers[index]}', '${tournamentId}', '${coupleId}', false, true)`)
    .join(',\n    ')

  return `
    insert into public.inscriptions (player_id, tournament_id, couple_id, is_pending, es_prueba)
    values
      ${values};
  `
}

const setupDb = (extraSql: string) => {
  execSql(`
    ${cleanupSql}
    ${seedBaseSql}
    ${extraSql}
  `)
}

const countRows = (sql: string) => Number(execSql(sql))

describeDb('tournament flow integration: zones, inscriptions, and brackets', () => {
  afterEach(() => {
    execSql(cleanupSql)
  })

  it('LONG registration path creates exactly one canonical zone_position and one optional mirror', async () => {
    setupDb(`
      ${seedLongTournamentSql}
      ${seedInscriptionsSql(ids.tournamentLong, [ids.couples[0]])}
    `)

    const supabase = createPsqlSupabaseClient()

    const first = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: ids.tournamentLong,
      zoneId: ids.zoneLong,
      coupleId: ids.couples[0],
    })

    const second = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: ids.tournamentLong,
      zoneId: ids.zoneLong,
      coupleId: ids.couples[0],
    })

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentLong}' and zone_id = '${ids.zoneLong}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneLong}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
  })

  it('AMERICAN registration alone does not create zone records until zone assignment runs', async () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      ${seedInscriptionsSql(ids.tournamentAmerican, [ids.couples[0]])}
    `)

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentAmerican}';`)).toBe(0)
    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneAmerican}';`)).toBe(0)

    const supabase = createPsqlSupabaseClient()
    const result = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: ids.tournamentAmerican,
      zoneId: ids.zoneAmerican,
      coupleId: ids.couples[0],
    })

    expect(result.success).toBe(true)
    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentAmerican}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
  })

  it('removing a tournament couple clears zone_positions, zone_couples, and inscriptions', async () => {
    setupDb(`
      ${seedLongTournamentSql}
      ${seedInscriptionsSql(ids.tournamentLong, [ids.couples[0]])}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values ('${ids.tournamentLong}', '${ids.zoneLong}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      insert into public.zone_couples (zone_id, couple_id)
      values ('${ids.zoneLong}', '${ids.couples[0]}');
    `)

    const result = await removeTournamentCoupleMembership({
      supabase: createPsqlSupabaseClient(),
      tournamentId: ids.tournamentLong,
      coupleId: ids.couples[0],
      deleteInscription: true,
    })

    expect(result.success).toBe(true)
    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentLong}' and couple_id = '${ids.couples[0]}';`)).toBe(0)
    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneLong}' and couple_id = '${ids.couples[0]}';`)).toBe(0)
    expect(countRows(`select count(*) from public.inscriptions where tournament_id = '${ids.tournamentLong}' and couple_id = '${ids.couples[0]}';`)).toBe(0)
  })

  it('database rejects a zone_couple without a matching tournament inscription', () => {
    setupDb(seedLongTournamentSql)

    expect(() => execSql(`
      insert into public.zone_couples (zone_id, couple_id)
      values ('${ids.zoneLong}', '${ids.couples[0]}');
    `)).toThrow('zone couple requires a matching tournament inscription')

    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneLong}';`)).toBe(0)
  })

  it('raw inscription deletion cannot leave zone membership mirrors behind', () => {
    setupDb(`
      ${seedLongTournamentSql}
      ${seedInscriptionsSql(ids.tournamentLong, [ids.couples[0]])}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values ('${ids.tournamentLong}', '${ids.zoneLong}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      insert into public.zone_couples (zone_id, couple_id)
      values ('${ids.zoneLong}', '${ids.couples[0]}');
    `)

    execSql(`
      delete from public.inscriptions
      where tournament_id = '${ids.tournamentLong}'
        and couple_id = '${ids.couples[0]}';
    `)

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentLong}';`)).toBe(0)
    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneLong}';`)).toBe(0)
  })

  it('allows an individual inscription to be converted to a couple inscription', () => {
    setupDb(`
      ${seedLongTournamentSql}
      insert into public.inscriptions (player_id, tournament_id, couple_id, is_pending, es_prueba)
      values ('${ids.players[0]}', '${ids.tournamentLong}', null, true, true);
    `)

    execSql(`
      update public.inscriptions
      set couple_id = '${ids.couples[0]}', is_pending = false
      where tournament_id = '${ids.tournamentLong}'
        and player_id = '${ids.players[0]}';
    `)

    expect(countRows(`
      select count(*)
      from public.inscriptions
      where tournament_id = '${ids.tournamentLong}'
        and couple_id = '${ids.couples[0]}'
        and is_pending = false;
    `)).toBe(1)
  })

  it('atomically adds, swaps, moves, and removes zone memberships', () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      insert into public.zones (id, tournament_id, name, capacity, max_couples, rounds_per_couple, es_prueba)
      values ('${ids.zoneAmericanB}', '${ids.tournamentAmerican}', 'Zona B', 3, 3, 2, true);
      ${seedInscriptionsSql(ids.tournamentAmerican, [ids.couples[0], ids.couples[1]])}
    `)

    execSql(`
      select public.apply_zone_membership_changes(
        '${ids.tournamentAmerican}',
        '[
          {"couple_id":"${ids.couples[0]}","from_zone_id":null,"to_zone_id":"${ids.zoneAmerican}","to_position":1},
          {"couple_id":"${ids.couples[1]}","from_zone_id":null,"to_zone_id":"${ids.zoneAmericanB}","to_position":1}
        ]'::jsonb
      );
    `)

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentAmerican}';`)).toBe(2)
    expect(countRows(`select count(*) from public.zone_couples where zone_id in ('${ids.zoneAmerican}', '${ids.zoneAmericanB}');`)).toBe(2)

    execSql(`
      select public.apply_zone_membership_changes(
        '${ids.tournamentAmerican}',
        '[
          {"couple_id":"${ids.couples[0]}","from_zone_id":"${ids.zoneAmerican}","to_zone_id":"${ids.zoneAmericanB}","to_position":1},
          {"couple_id":"${ids.couples[1]}","from_zone_id":"${ids.zoneAmericanB}","to_zone_id":"${ids.zoneAmerican}","to_position":1}
        ]'::jsonb
      );
    `)

    expect(countRows(`select count(*) from public.zone_positions where zone_id = '${ids.zoneAmericanB}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
    expect(countRows(`select count(*) from public.zone_positions where zone_id = '${ids.zoneAmerican}' and couple_id = '${ids.couples[1]}';`)).toBe(1)

    execSql(`
      select public.apply_zone_membership_changes(
        '${ids.tournamentAmerican}',
        '[{"couple_id":"${ids.couples[0]}","from_zone_id":"${ids.zoneAmericanB}","to_zone_id":null,"to_position":null}]'::jsonb
      );
    `)

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentAmerican}' and couple_id = '${ids.couples[0]}';`)).toBe(0)
    expect(countRows(`select count(*) from public.zone_couples where couple_id = '${ids.couples[0]}';`)).toBe(0)
  })

  it('rolls back the entire membership batch when one change is invalid', () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      ${seedInscriptionsSql(ids.tournamentAmerican, [ids.couples[0]])}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      insert into public.zone_couples (zone_id, couple_id)
      values ('${ids.zoneAmerican}', '${ids.couples[0]}');
    `)

    expect(() => execSql(`
      select public.apply_zone_membership_changes(
        '${ids.tournamentAmerican}',
        '[
          {"couple_id":"${ids.couples[0]}","from_zone_id":"${ids.zoneAmerican}","to_zone_id":null,"to_position":null},
          {"couple_id":"${ids.couples[1]}","from_zone_id":null,"to_zone_id":"${ids.zoneAmerican}","to_position":2}
        ]'::jsonb
      );
    `)).toThrow('target couple does not have a valid tournament inscription')

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentAmerican}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
    expect(countRows(`select count(*) from public.zone_couples where zone_id = '${ids.zoneAmerican}' and couple_id = '${ids.couples[0]}';`)).toBe(1)
  })

  it('atomic ranking replacement preserves existing positions when validation fails', () => {
    setupDb(`
      ${seedLongTournamentSql}
      ${seedInscriptionsSql(ids.tournamentLong, [ids.couples[0], ids.couples[1]])}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values
        ('${ids.tournamentLong}', '${ids.zoneLong}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentLong}', '${ids.zoneLong}', '${ids.couples[1]}', 2, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    `)

    expect(() => execSql(`
      select public.replace_zone_positions(
        '${ids.tournamentLong}',
        '${ids.zoneLong}',
        '[
          {"couple_id":"${ids.couples[0]}","position":1},
          {"couple_id":"${ids.couples[2]}","position":2}
        ]'::jsonb
      );
    `)).toThrow('position payload contains a non-member or unregistered couple')

    expect(countRows(`select count(*) from public.zone_positions where tournament_id = '${ids.tournamentLong}';`)).toBe(2)
  })

  it('syncs zone metadata when a fourth couple is added and allows a third match', async () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      ${seedInscriptionsSql(ids.tournamentAmerican)}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[1]}', 2, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[2]}', 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      insert into public.zone_couples (zone_id, couple_id)
      values
        ('${ids.zoneAmerican}', '${ids.couples[0]}'),
        ('${ids.zoneAmerican}', '${ids.couples[1]}'),
        ('${ids.zoneAmerican}', '${ids.couples[2]}');
    `)

    const supabase = createPsqlSupabaseClient()
    const initialSync = await ZoneRulesSyncService.syncZoneRulesForZone(supabase, ids.zoneAmerican)
    expect(initialSync.success).toBe(true)
    expect(initialSync.roundsPerCouple).toBe(2)

    const addResult = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: ids.tournamentAmerican,
      zoneId: ids.zoneAmerican,
      coupleId: ids.couples[3],
    })
    expect(addResult.success).toBe(true)

    const finalRules = await ZoneMatchRulesService.getRulesForZone(supabase, ids.zoneAmerican)
    expect(finalRules.maxMatchesPerCouple).toBe(3)

    execSql(`
      insert into public.matches (tournament_id, zone_id, couple1_id, couple2_id, type, round, status, es_prueba)
      values
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', '${ids.couples[1]}', 'ZONE', 'ZONE', 'FINISHED', true),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', '${ids.couples[2]}', 'ZONE', 'ZONE', 'FINISHED', true);
    `)

    const currentMatches = countRows(`
      select count(*)
      from public.matches
      where zone_id = '${ids.zoneAmerican}'
        and (couple1_id = '${ids.couples[0]}' or couple2_id = '${ids.couples[0]}');
    `)
    expect(currentMatches).toBe(2)
    expect(currentMatches < finalRules.maxMatchesPerCouple).toBe(true)

    const zone = readJson<Array<{ capacity: number; max_couples: number; rounds_per_couple: number | null }>>(`
      select json_agg(row_to_json(z))
      from (
        select capacity, max_couples, rounds_per_couple
        from public.zones
        where id = '${ids.zoneAmerican}'
      ) z;
    `)[0]

    expect(zone).toEqual({
      capacity: 4,
      max_couples: 4,
      rounds_per_couple: 3,
    })
  })

  it('keeps temporary zones of 2 playable with one official match', async () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      ${seedInscriptionsSql(ids.tournamentAmerican, [ids.couples[0], ids.couples[1]])}
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[1]}', 2, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    `)

    const rules = await ZoneMatchRulesService.getRulesForZone(createPsqlSupabaseClient(), ids.zoneAmerican)

    expect(rules.coupleCount).toBe(2)
    expect(rules.maxMatchesPerCouple).toBe(1)
  })

  it('syncs both zones after moving a couple and keeps zone_positions canonical over zone_couples', async () => {
    setupDb(`
      ${seedAmericanTournamentSql}
      ${seedInscriptionsSql(ids.tournamentAmerican)}
      insert into public.zones (id, tournament_id, name, capacity, max_couples, rounds_per_couple, es_prueba)
      values ('${ids.zoneAmericanB}', '${ids.tournamentAmerican}', 'Zona B', 2, 3, 1, true);
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[0]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[1]}', 2, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[2]}', 3, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ('${ids.tournamentAmerican}', '${ids.zoneAmerican}', '${ids.couples[3]}', 4, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      insert into public.zone_couples (zone_id, couple_id)
      values
        ('${ids.zoneAmerican}', '${ids.couples[0]}'),
        ('${ids.zoneAmerican}', '${ids.couples[1]}'),
        ('${ids.zoneAmerican}', '${ids.couples[2]}');
    `)

    const supabase = createPsqlSupabaseClient()
    const rulesWithStaleMirror = await ZoneMatchRulesService.getRulesForZone(supabase, ids.zoneAmerican)
    expect(rulesWithStaleMirror.coupleCount).toBe(4)
    expect(rulesWithStaleMirror.maxMatchesPerCouple).toBe(3)

    execSql(`
      delete from public.zone_positions
      where tournament_id = '${ids.tournamentAmerican}'
        and zone_id = '${ids.zoneAmerican}'
        and couple_id = '${ids.couples[3]}';
      insert into public.zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
      values ('${ids.tournamentAmerican}', '${ids.zoneAmericanB}', '${ids.couples[3]}', 1, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    `)

    const syncResults = await ZoneRulesSyncService.syncZoneRulesForZones(supabase, [ids.zoneAmerican, ids.zoneAmericanB])
    expect(syncResults.every((result) => result.success)).toBe(true)

    const zones = readJson<Array<{ id: string; capacity: number; max_couples: number; rounds_per_couple: number | null }>>(`
      select json_agg(row_to_json(z))
      from (
        select id, capacity, max_couples, rounds_per_couple
        from public.zones
        where id in ('${ids.zoneAmerican}', '${ids.zoneAmericanB}')
        order by id
      ) z;
    `)

    expect(zones).toEqual([
      {
        id: ids.zoneAmerican,
        capacity: 3,
        max_couples: 4,
        rounds_per_couple: 2,
      },
      {
        id: ids.zoneAmericanB,
        capacity: 1,
        max_couples: 4,
        rounds_per_couple: null,
      },
    ])
  })

  it('generates elimination bracket artifacts and leaves tournament state consistent', async () => {
    setupDb(`
      ${seedLongTournamentSql}
      ${seedInscriptionsSql(ids.tournamentLong)}
      insert into public.tournament_couple_seeds (tournament_id, couple_id, seed, bracket_position, es_prueba)
      values
        ('${ids.tournamentLong}', '${ids.couples[0]}', 1, 1, true),
        ('${ids.tournamentLong}', '${ids.couples[1]}', 2, 4, true),
        ('${ids.tournamentLong}', '${ids.couples[2]}', 3, 2, true),
        ('${ids.tournamentLong}', '${ids.couples[3]}', 4, 3, true);
    `)

    const result = await generateBracketFromSeeding(ids.tournamentLong, createPsqlSupabaseClient())

    expect(result.success).toBe(true)
    expect(countRows(`select count(*) from public.matches where tournament_id = '${ids.tournamentLong}' and type = 'ELIMINATION';`)).toBe(3)
    expect(countRows(`select count(*) from public.match_hierarchy where tournament_id = '${ids.tournamentLong}';`)).toBe(2)

    const tournament = readJson<Array<{ status: string; bracket_status: string; bracket_generated_at: string | null }>>(`
      select json_agg(row_to_json(t))
      from (
        select status::text, bracket_status::text, bracket_generated_at
        from public.tournaments
        where id = '${ids.tournamentLong}'
      ) t;
    `)[0]

    expect(tournament.status).toBe('BRACKET_PHASE')
    expect(tournament.bracket_status).toBe('BRACKET_GENERATED')
    expect(tournament.bracket_generated_at).not.toBeNull()
  })
})
