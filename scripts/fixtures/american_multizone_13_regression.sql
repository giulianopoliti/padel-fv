begin;

delete from match_hierarchy where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from tournament_couple_seeds where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from matches where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from zone_positions where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from zones where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from inscriptions where tournament_id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from tournaments where id = '127fab09-c2a4-4081-bf0c-1496814d8c67';
delete from couples where id in (
  select ('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid
  from generate_series(1, 13) as n
);
delete from players where id in (
  select ('00000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid
  from generate_series(1, 26) as n
);

insert into tournaments (
  id,
  name,
  type,
  format_type,
  format_config,
  status,
  bracket_status,
  gender,
  max_participants,
  club_id,
  es_prueba
) values (
  '127fab09-c2a4-4081-bf0c-1496814d8c67',
  'Fixture Americano 13 parejas',
  'AMERICAN',
  'AMERICAN_2',
  '{
    "version": 2,
    "presetId": "AMERICAN_MULTI_ZONE_2",
    "baseType": "AMERICAN",
    "zoneMode": "MULTI_ZONE",
    "zoneStage": "FIXED_MATCH_COUNT",
    "targetMatchesPerCouple": 2,
    "bracketMode": "SINGLE",
    "advancementConfig": { "kind": "SINGLE", "advanceCount": 10 },
    "rankingScope": "PER_ZONE",
    "rankingPolicyId": "STANDARD_PADEL",
    "qualificationSource": "ZONE_POSITIONS",
    "bracketSeedingStrategy": "SERPENTINE_BY_ZONE",
    "zoneRules": { "minSize": 3, "maxSize": 5, "idealSize": 4, "allowedSizes": [3, 4, 5] },
    "display": { "name": "Americano por zonas (2 partidos)", "description": "Regression fixture" }
  }'::jsonb,
  'ZONE_PHASE',
  'NOT_STARTED',
  'FEMALE',
  13,
  null,
  true
);

insert into zones (id, tournament_id, name, capacity, max_couples, rounds_per_couple, es_prueba) values
  ('00000000-0000-4000-8000-0000000000a1', '127fab09-c2a4-4081-bf0c-1496814d8c67', 'Zona A', 4, 4, 2, true),
  ('00000000-0000-4000-8000-0000000000b1', '127fab09-c2a4-4081-bf0c-1496814d8c67', 'Zona B', 3, 3, 2, true),
  ('00000000-0000-4000-8000-0000000000c1', '127fab09-c2a4-4081-bf0c-1496814d8c67', 'Zona C', 3, 3, 2, true),
  ('00000000-0000-4000-8000-0000000000d1', '127fab09-c2a4-4081-bf0c-1496814d8c67', 'Zona D', 3, 3, 2, true);

insert into players (id, first_name, last_name, es_prueba)
select
  ('00000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
  'Fixture',
  'Player ' || n,
  true
from generate_series(1, 26) as n
on conflict (id) do nothing;

insert into couples (id, player1_id, player2_id, es_prueba)
select
  ('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  ('00000000-0000-4000-8000-0000000002' || lpad(((n * 2) - 1)::text, 2, '0'))::uuid,
  ('00000000-0000-4000-8000-0000000002' || lpad((n * 2)::text, 2, '0'))::uuid,
  true
from generate_series(1, 13) as n
on conflict (id) do nothing;

insert into inscriptions (tournament_id, couple_id, es_prueba)
select '127fab09-c2a4-4081-bf0c-1496814d8c67', ('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, true
from generate_series(1, 13) as n;

insert into zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference)
values
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000101', 1, true, 6, 2, 0, 12, 4, 8),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000102', 2, true, 3, 1, 1, 10, 8, 2),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000103', 3, true, 3, 1, 1, 8, 10, -2),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000104', 4, true, 0, 0, 2, 4, 12, -8),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000105', 1, true, 6, 2, 0, 12, 5, 7),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000106', 2, true, 3, 1, 1, 9, 9, 0),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000107', 3, true, 0, 0, 2, 5, 12, -7),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000108', 1, false, 3, 1, 1, 9, 8, 1),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000109', 2, false, 3, 1, 1, 8, 8, 0),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000110', 3, true, 0, 0, 2, 5, 11, -6),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000111', 1, true, 6, 2, 0, 12, 6, 6),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000112', 2, true, 3, 1, 1, 9, 9, 0),
  ('127fab09-c2a4-4081-bf0c-1496814d8c67', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000113', 3, true, 0, 0, 2, 6, 12, -6);

commit;
