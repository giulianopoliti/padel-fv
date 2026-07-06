-- Repro local del torneo Padel Elite c9d52dbb-2188-4715-9333-fc1ad82b62d4.
-- Estado buscado: bracket phase, GLOBAL_STANDINGS, con el partido de Zona B
-- 8bd81fdb-9f7d-4e71-8e14-27ceeb9b74ec pendiente (sin resultado).
--
-- Uso sugerido:
--   docker exec -i supabase_db_padel-base psql -U postgres -d postgres < scripts/fixtures/padel_elite_c9d52_global_pending_repro.sql
--
-- Para simular el snapshot roto de prod, ejecutar luego:
--   update tournament_couple_seeds
--   set couple_id = 'a4227831-8221-4fb5-a6b6-b5e1774e7b4a',
--       is_placeholder = false,
--       placeholder_label = null,
--       placeholder_position = null,
--       resolved_at = '2026-07-04T03:41:24.101Z'
--   where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4' and seed = 4;

begin;

delete from match_hierarchy where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from tournament_couple_seeds where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from matches where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from zone_positions where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from inscriptions where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from zones where tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
delete from tournaments where id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';

delete from couples where id in (
  '03b36b32-7786-4bef-8306-cb0da62d1fdb',
  '223fa644-93ec-414b-b046-6d24eb0a1895',
  '5897ffe7-d27c-4849-816c-9e1c0702b05c',
  '701d2035-930f-446c-8363-ab8ac4eda28c',
  '8e657416-8d8e-4c41-9fbe-a281b5f8035e',
  '8ee1886c-4442-4163-ae5d-1b6ac60c0809',
  '9c5f3ec7-cfae-4c99-afa6-c19b17e87988',
  'a4227831-8221-4fb5-a6b6-b5e1774e7b4a',
  'b7062124-3721-4b3b-8f66-532950759b11',
  'be2db29c-c8c9-4937-b91d-e48582b3c388',
  'c021176a-1486-40a5-8552-9b137b664e39',
  'd45865ca-f92b-4f13-849b-21c9cd8af53c',
  'e9b73146-66ef-4c88-bc3e-494ddeb1e2c6',
  'ffedddb8-911a-4170-b3e3-3138293c5e96'
);

insert into tournaments (
  id, name, category_name, type, format_type, format_config, gender, status,
  max_participants, club_id, es_prueba, allows_placeholder_brackets,
  placeholder_brackets_generated_at, bracket_status, registration_locked,
  bracket_generated_at, uses_new_system, uses_new_zone_system,
  enable_draft_matches, is_draft, enable_public_inscriptions,
  enable_payment_checkboxes, enable_transfer_proof, category_config,
  hide_venue, registration_locked_by_capacity, show_few_slots_alert,
  validate_inscriptions
) values (
  'c9d52dbb-2188-4715-9333-fc1ad82b62d4',
  'Americano Caballeros 6TA - repro c9d52',
  '6ta',
  'AMERICAN',
  'AMERICAN_2',
  '{
    "display": {
      "name": "Americano multizona tabla general",
      "description": "Zonas multiples con partidos por pareja configurables y llave sembrada desde una tabla general."
    },
    "version": 2,
    "baseType": "AMERICAN",
    "presetId": "AMERICAN_MULTI_ZONE_GLOBAL_2",
    "zoneMode": "MULTI_ZONE",
    "zoneRules": { "maxSize": 5, "minSize": 3, "idealSize": 4, "allowedSizes": [3, 4, 5] },
    "zoneStage": "FIXED_MATCH_COUNT",
    "bracketMode": "SINGLE",
    "rankingScope": "GLOBAL",
    "rankingPolicyId": "STANDARD_PADEL",
    "advancementConfig": { "kind": "SINGLE", "advanceCount": 64 },
    "qualificationSource": "GLOBAL_STANDINGS",
    "bracketSeedingStrategy": "GLOBAL_RANKING",
    "targetMatchesPerCouple": 2
  }'::jsonb,
  'MALE',
  'BRACKET_PHASE',
  16,
  null,
  true,
  true,
  '2026-07-04T03:31:02.913Z',
  'BRACKET_GENERATED',
  true,
  '2026-07-04T03:31:02.913Z',
  true,
  false,
  false,
  false,
  false,
  true,
  false,
  '{"mode":"SINGLE","category":"6ta","validationEnabled":false}'::jsonb,
  false,
  false,
  true,
  false
);

insert into zones (id, tournament_id, name, capacity, max_couples, rounds_per_couple, es_prueba, created_at) values
  ('e30aa69c-cb00-4811-a9e3-72e7ad329d8e', 'c9d52dbb-2188-4715-9333-fc1ad82b62d4', 'Zona A', 4, 5, 2, true, '2026-07-04T01:39:56.059389Z'),
  ('85ed0046-b760-4dea-a8b2-6f27d67bd2d2', 'c9d52dbb-2188-4715-9333-fc1ad82b62d4', 'Zona B', 4, 5, 2, true, '2026-07-04T01:39:56.059389Z'),
  ('7d88ea68-725a-4b3a-81af-fbee06fe6ec5', 'c9d52dbb-2188-4715-9333-fc1ad82b62d4', 'Zona C', 3, 5, 2, true, '2026-07-04T01:39:56.059389Z'),
  ('3f3650d8-c29d-4fd4-8710-984fa74864bd', 'c9d52dbb-2188-4715-9333-fc1ad82b62d4', 'Zona D', 3, 5, 2, true, '2026-07-04T01:39:56.059389Z');

insert into players (id, first_name, last_name, score, category_name, gender, status, is_categorized, es_prueba, dni_is_temporary)
values
  ('9a25777c-de52-4177-9047-cb5543102116','Adrian','Anolles',750,'7ma','MALE','active',true,true,false),
  ('8ddd84a4-60f4-450a-99cb-d73367399b4b','Agustin','Garcia Esteban',600,'7ma','MALE','active',true,true,false),
  ('e8929914-5f7b-4838-9f6d-5c585ebf2db3','Agustin','Pierini',900,'6ta','MALE','active',true,true,false),
  ('06fabfb2-aabf-4e30-8d66-c38c80713e51','Agustin','Solari',750,'7ma','MALE','active',true,true,false),
  ('c81a10ea-fa20-4d75-84a3-2b5d36b7e305','Ariel','orellano',900,'6ta','MALE','active',true,true,false),
  ('03deb50d-03a1-4f2e-8d7c-8bb7e78beac4','Cristian','Bossio',750,'7ma','MALE','active',true,true,false),
  ('0d3a7530-d13a-48ea-b450-ac6020368aa3','Cristian','Hernandez',900,'6ta','MALE','active',true,true,false),
  ('0b13ce9f-a649-4b2d-8d6a-5b97e8034582','Emanuel','Cuinas',900,'6ta','MALE','active',true,true,false),
  ('7f92acd1-f37a-4b8e-bced-1090ef32f789','Facundo emanuel','Lisboa',900,'6ta','MALE','active',true,true,false),
  ('ca8abaf3-4c65-4fa1-bca9-7eac23c49f01','Gabriel','Trivelli',900,'6ta','MALE','active',true,true,false),
  ('b9bb5127-90a7-43a3-addf-6c3ddf88e6ca','ignacio','canales',750,'7ma','MALE','active',true,true,false),
  ('a05d8150-7912-4bc1-a1c9-dd0b27198726','Jalil','Karami',900,'6ta','MALE','active',true,true,false),
  ('353eb77f-5c58-4130-8d3f-593d5847bcec','Joaquin','Tobal',900,'6ta','MALE','active',true,true,false),
  ('fb15833b-795d-4f31-987b-3540c4fd4f57','Juampii','Villagran',750,'7ma','MALE','active',true,true,false),
  ('4e74ad0a-cdd6-4132-b1c9-26f08e4e9a9f','Juan','Azzolini',1200,'5ta','MALE','active',true,true,false),
  ('9c44a979-6d44-4487-baae-146eedcc20ba','Kevin','Dominguez',900,'6ta','MALE','active',true,true,false),
  ('d89b61eb-73ae-46d4-8ce3-cbac9258866c','Lucas','Aciar',900,'6ta','MALE','active',true,true,false),
  ('40680e8c-0888-4fda-9436-a73db792e143','Lucia','Gutierrez',900,'6ta','FEMALE','active',true,true,false),
  ('9629f909-81d5-4a0e-af67-e9595bed3e02','Marcelo','Diciancia',900,'6ta','MALE','active',true,true,false),
  ('42cdd31d-30df-4dd0-886a-1ad5923c84be','Matias','Bertoni',900,'6ta','MALE','active',true,true,false),
  ('ba3447f2-8b5d-41e5-951c-9287aa9d9642','Maximiliano','Mantesi',900,'6ta','MALE','active',true,true,false),
  ('469ab544-0265-45ab-8967-cca0ed79f524','nicolas','laterra',900,'6ta','MALE','active',true,true,false),
  ('50120427-b930-4c1d-ab4a-b85dbfcbd502','Pablo','Rossi',900,'6ta','MALE','active',true,true,false),
  ('5798102c-6e4c-4866-bda5-41c0c99ea885','Patricio','Szczygiel',600,'7ma','MALE','active',true,true,false),
  ('5af8dadb-0c5b-4dfa-a473-7b8b915174ba','Tiziano','Hernandez',900,'6ta','MALE','active',true,true,false),
  ('eca4de94-97d6-446d-9509-9d2590e850b6','tomas','LEIS',750,'7ma','MALE','active',true,true,false),
  ('b9d47aa6-2535-4732-9abd-93e68ea82132','Tomas','Napoli',900,'6ta','MALE','active',true,true,false),
  ('41708aa7-4b85-4b72-9204-dc1412fa98e3','Tomas','Sandona',900,'6ta','MALE','active',true,true,false)
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  score = excluded.score,
  category_name = excluded.category_name,
  gender = excluded.gender,
  status = excluded.status,
  is_categorized = excluded.is_categorized,
  es_prueba = excluded.es_prueba,
  dni_is_temporary = excluded.dni_is_temporary;

insert into couples (id, player1_id, player2_id, es_prueba) values
  ('ffedddb8-911a-4170-b3e3-3138293c5e96','b9bb5127-90a7-43a3-addf-6c3ddf88e6ca','06fabfb2-aabf-4e30-8d66-c38c80713e51',true),
  ('701d2035-930f-446c-8363-ab8ac4eda28c','41708aa7-4b85-4b72-9204-dc1412fa98e3','353eb77f-5c58-4130-8d3f-593d5847bcec',true),
  ('a4227831-8221-4fb5-a6b6-b5e1774e7b4a','fb15833b-795d-4f31-987b-3540c4fd4f57','03deb50d-03a1-4f2e-8d7c-8bb7e78beac4',true),
  ('d45865ca-f92b-4f13-849b-21c9cd8af53c','eca4de94-97d6-446d-9509-9d2590e850b6','c81a10ea-fa20-4d75-84a3-2b5d36b7e305',true),
  ('be2db29c-c8c9-4937-b91d-e48582b3c388','9a25777c-de52-4177-9047-cb5543102116','ba3447f2-8b5d-41e5-951c-9287aa9d9642',true),
  ('c021176a-1486-40a5-8552-9b137b664e39','ca8abaf3-4c65-4fa1-bca9-7eac23c49f01','d89b61eb-73ae-46d4-8ce3-cbac9258866c',true),
  ('b7062124-3721-4b3b-8f66-532950759b11','9c44a979-6d44-4487-baae-146eedcc20ba','0d3a7530-d13a-48ea-b450-ac6020368aa3',true),
  ('9c5f3ec7-cfae-4c99-afa6-c19b17e87988','50120427-b930-4c1d-ab4a-b85dbfcbd502','9629f909-81d5-4a0e-af67-e9595bed3e02',true),
  ('8e657416-8d8e-4c41-9fbe-a281b5f8035e','469ab544-0265-45ab-8967-cca0ed79f524','e8929914-5f7b-4838-9f6d-5c585ebf2db3',true),
  ('5897ffe7-d27c-4849-816c-9e1c0702b05c','42cdd31d-30df-4dd0-886a-1ad5923c84be','a05d8150-7912-4bc1-a1c9-dd0b27198726',true),
  ('8ee1886c-4442-4163-ae5d-1b6ac60c0809','4e74ad0a-cdd6-4132-b1c9-26f08e4e9a9f','b9d47aa6-2535-4732-9abd-93e68ea82132',true),
  ('e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','7f92acd1-f37a-4b8e-bced-1090ef32f789','5af8dadb-0c5b-4dfa-a473-7b8b915174ba',true),
  ('223fa644-93ec-414b-b046-6d24eb0a1895','40680e8c-0888-4fda-9436-a73db792e143','0b13ce9f-a649-4b2d-8d6a-5b97e8034582',true),
  ('03b36b32-7786-4bef-8306-cb0da62d1fdb','8ddd84a4-60f4-450a-99cb-d73367399b4b','5798102c-6e4c-4866-bda5-41c0c99ea885',true)
on conflict (id) do update set
  player1_id = excluded.player1_id,
  player2_id = excluded.player2_id,
  es_prueba = excluded.es_prueba;

insert into inscriptions (
  id,
  tournament_id,
  couple_id,
  player_id,
  is_pending,
  es_prueba,
  is_eliminated,
  payment_proof_status
) values
  ('10000000-0000-4000-8000-000000000001','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ffedddb8-911a-4170-b3e3-3138293c5e96','b9bb5127-90a7-43a3-addf-6c3ddf88e6ca',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000002','c9d52dbb-2188-4715-9333-fc1ad82b62d4','701d2035-930f-446c-8363-ab8ac4eda28c','41708aa7-4b85-4b72-9204-dc1412fa98e3',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000003','c9d52dbb-2188-4715-9333-fc1ad82b62d4','a4227831-8221-4fb5-a6b6-b5e1774e7b4a','fb15833b-795d-4f31-987b-3540c4fd4f57',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000004','c9d52dbb-2188-4715-9333-fc1ad82b62d4','d45865ca-f92b-4f13-849b-21c9cd8af53c','eca4de94-97d6-446d-9509-9d2590e850b6',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000005','c9d52dbb-2188-4715-9333-fc1ad82b62d4','be2db29c-c8c9-4937-b91d-e48582b3c388','9a25777c-de52-4177-9047-cb5543102116',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000006','c9d52dbb-2188-4715-9333-fc1ad82b62d4','c021176a-1486-40a5-8552-9b137b664e39','ca8abaf3-4c65-4fa1-bca9-7eac23c49f01',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000007','c9d52dbb-2188-4715-9333-fc1ad82b62d4','b7062124-3721-4b3b-8f66-532950759b11','9c44a979-6d44-4487-baae-146eedcc20ba',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000008','c9d52dbb-2188-4715-9333-fc1ad82b62d4','9c5f3ec7-cfae-4c99-afa6-c19b17e87988','50120427-b930-4c1d-ab4a-b85dbfcbd502',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000009','c9d52dbb-2188-4715-9333-fc1ad82b62d4','8e657416-8d8e-4c41-9fbe-a281b5f8035e','469ab544-0265-45ab-8967-cca0ed79f524',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000010','c9d52dbb-2188-4715-9333-fc1ad82b62d4','5897ffe7-d27c-4849-816c-9e1c0702b05c','42cdd31d-30df-4dd0-886a-1ad5923c84be',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000011','c9d52dbb-2188-4715-9333-fc1ad82b62d4','8ee1886c-4442-4163-ae5d-1b6ac60c0809','4e74ad0a-cdd6-4132-b1c9-26f08e4e9a9f',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000012','c9d52dbb-2188-4715-9333-fc1ad82b62d4','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','7f92acd1-f37a-4b8e-bced-1090ef32f789',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000013','c9d52dbb-2188-4715-9333-fc1ad82b62d4','223fa644-93ec-414b-b046-6d24eb0a1895','40680e8c-0888-4fda-9436-a73db792e143',false,true,false,'NOT_REQUIRED'),
  ('10000000-0000-4000-8000-000000000014','c9d52dbb-2188-4715-9333-fc1ad82b62d4','03b36b32-7786-4bef-8306-cb0da62d1fdb','8ddd84a4-60f4-450a-99cb-d73367399b4b',false,true,false,'NOT_REQUIRED');

insert into zone_positions (tournament_id, zone_id, couple_id, position, is_definitive, points, wins, losses, games_for, games_against, games_difference, player_score_total, sets_for, sets_against, sets_difference)
values
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','ffedddb8-911a-4170-b3e3-3138293c5e96',1,false,0,2,0,12,4,8,1500,2,0,2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','d45865ca-f92b-4f13-849b-21c9cd8af53c',2,false,0,1,1,7,10,-3,1650,1,1,0),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','a4227831-8221-4fb5-a6b6-b5e1774e7b4a',3,false,0,1,1,10,7,3,1500,1,1,0),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','701d2035-930f-446c-8363-ab8ac4eda28c',4,true,0,0,2,4,12,-8,1800,0,2,-2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','be2db29c-c8c9-4937-b91d-e48582b3c388',1,false,0,1,0,6,3,3,1650,1,0,1),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','9c5f3ec7-cfae-4c99-afa6-c19b17e87988',2,false,0,1,0,6,5,1,1800,1,0,1),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','b7062124-3721-4b3b-8f66-532950759b11',3,false,0,1,1,11,9,2,1800,1,1,0),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','c021176a-1486-40a5-8552-9b137b664e39',4,true,0,0,2,6,12,-6,1800,0,2,-2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','8e657416-8d8e-4c41-9fbe-a281b5f8035e',1,false,0,2,0,12,9,3,1800,2,0,2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','5897ffe7-d27c-4849-816c-9e1c0702b05c',2,false,0,1,1,11,11,0,1800,1,1,0),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','8ee1886c-4442-4163-ae5d-1b6ac60c0809',3,true,0,0,2,9,12,-3,2100,0,2,-2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','3f3650d8-c29d-4fd4-8710-984fa74864bd','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6',1,false,0,2,0,12,5,7,1800,2,0,2),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','3f3650d8-c29d-4fd4-8710-984fa74864bd','03b36b32-7786-4bef-8306-cb0da62d1fdb',2,false,0,1,1,6,8,-2,1200,1,1,0),
  ('c9d52dbb-2188-4715-9333-fc1ad82b62d4','3f3650d8-c29d-4fd4-8710-984fa74864bd','223fa644-93ec-414b-b046-6d24eb0a1895',3,false,0,0,2,7,12,-5,1800,0,2,-2);

insert into matches (id, tournament_id, type, round, zone_id, couple1_id, couple2_id, result_couple1, result_couple2, winner_id, status, bracket_key, es_prueba)
values
  ('31323fc7-82f1-462d-bf03-2a6ca1ec08e5','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','ffedddb8-911a-4170-b3e3-3138293c5e96','701d2035-930f-446c-8363-ab8ac4eda28c','6','3','ffedddb8-911a-4170-b3e3-3138293c5e96','FINISHED','MAIN',true),
  ('1f223282-6f40-4364-a321-411010ea718c','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','a4227831-8221-4fb5-a6b6-b5e1774e7b4a','d45865ca-f92b-4f13-849b-21c9cd8af53c','4','6','d45865ca-f92b-4f13-849b-21c9cd8af53c','FINISHED','MAIN',true),
  ('445edfd7-cb2b-470f-9ac5-f4f09fce0e0f','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','701d2035-930f-446c-8363-ab8ac4eda28c','a4227831-8221-4fb5-a6b6-b5e1774e7b4a','1','6','a4227831-8221-4fb5-a6b6-b5e1774e7b4a','FINISHED','MAIN',true),
  ('220d6293-003e-4fde-a3ed-9442112d9450','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','e30aa69c-cb00-4811-a9e3-72e7ad329d8e','d45865ca-f92b-4f13-849b-21c9cd8af53c','ffedddb8-911a-4170-b3e3-3138293c5e96','1','6','ffedddb8-911a-4170-b3e3-3138293c5e96','FINISHED','MAIN',true),
  ('efe63e74-751c-4e9c-a78c-15043105750c','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','be2db29c-c8c9-4937-b91d-e48582b3c388','c021176a-1486-40a5-8552-9b137b664e39','6','3','be2db29c-c8c9-4937-b91d-e48582b3c388','FINISHED','MAIN',true),
  ('6938b950-4376-46ae-abed-5ff7cb010b8c','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','b7062124-3721-4b3b-8f66-532950759b11','9c5f3ec7-cfae-4c99-afa6-c19b17e87988','5','6','9c5f3ec7-cfae-4c99-afa6-c19b17e87988','FINISHED','MAIN',true),
  ('853d56eb-f2e2-474c-b3cd-9e261527b6b4','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','c021176a-1486-40a5-8552-9b137b664e39','b7062124-3721-4b3b-8f66-532950759b11','3','6','b7062124-3721-4b3b-8f66-532950759b11','FINISHED','MAIN',true),
  ('8bd81fdb-9f7d-4e71-8e14-27ceeb9b74ec','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','85ed0046-b760-4dea-a8b2-6f27d67bd2d2','9c5f3ec7-cfae-4c99-afa6-c19b17e87988','be2db29c-c8c9-4937-b91d-e48582b3c388',null,null,null,'IN_PROGRESS','MAIN',true),
  ('568b24ae-2d68-42eb-95db-6677e0c58358','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','8e657416-8d8e-4c41-9fbe-a281b5f8035e','5897ffe7-d27c-4849-816c-9e1c0702b05c','6','5','8e657416-8d8e-4c41-9fbe-a281b5f8035e','FINISHED','MAIN',true),
  ('7f971a16-727e-4b94-8411-212c701fdbd4','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','5897ffe7-d27c-4849-816c-9e1c0702b05c','8ee1886c-4442-4163-ae5d-1b6ac60c0809','6','5','5897ffe7-d27c-4849-816c-9e1c0702b05c','FINISHED','MAIN',true),
  ('7b12f47a-4d29-4876-be3a-6b3e1dfa0d30','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','7d88ea68-725a-4b3a-81af-fbee06fe6ec5','8ee1886c-4442-4163-ae5d-1b6ac60c0809','8e657416-8d8e-4c41-9fbe-a281b5f8035e','4','6','8e657416-8d8e-4c41-9fbe-a281b5f8035e','FINISHED','MAIN',true),
  ('bc60e4b3-4f9c-4b2c-9fa6-4ba249a60b98','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','3f3650d8-c29d-4fd4-8710-984fa74864bd','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','223fa644-93ec-414b-b046-6d24eb0a1895','6','5','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','FINISHED','MAIN',true),
  ('3d21e88c-dcda-445a-876a-102ff53ce1a2','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','3f3650d8-c29d-4fd4-8710-984fa74864bd','03b36b32-7786-4bef-8306-cb0da62d1fdb','223fa644-93ec-414b-b046-6d24eb0a1895','6','2','03b36b32-7786-4bef-8306-cb0da62d1fdb','FINISHED','MAIN',true),
  ('1e72e62b-2dc0-49ca-8af2-f5349fbeac5e','c9d52dbb-2188-4715-9333-fc1ad82b62d4','ZONE','ZONE','3f3650d8-c29d-4fd4-8710-984fa74864bd','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','03b36b32-7786-4bef-8306-cb0da62d1fdb','6','0','e9b73146-66ef-4c88-bc3e-494ddeb1e2c6','FINISHED','MAIN',true);

insert into tournament_couple_seeds (
  id, tournament_id, seed, bracket_position, couple_id, is_placeholder,
  placeholder_label, placeholder_zone_id, placeholder_position,
  created_as_placeholder, bracket_key, es_prueba
) values
  ('a387c2fb-4bf4-4737-9a87-b3087b57393b','c9d52dbb-2188-4715-9333-fc1ad82b62d4',1,1,'ffedddb8-911a-4170-b3e3-3138293c5e96',false,null,null,null,true,'MAIN',true),
  ('175feacd-c6b8-4a36-8443-6fa1080632b2','c9d52dbb-2188-4715-9333-fc1ad82b62d4',2,16,null,true,'#2 general',null,2,true,'MAIN',true),
  ('66b4a4a1-9e1a-454f-906e-67335693d610','c9d52dbb-2188-4715-9333-fc1ad82b62d4',3,9,null,true,'#3 general',null,3,true,'MAIN',true),
  ('91a2ba08-b22a-4951-aeec-805dd38ad936','c9d52dbb-2188-4715-9333-fc1ad82b62d4',4,8,null,true,'#4 general',null,4,true,'MAIN',true),
  ('9546257d-a780-4b01-aea7-7fbea08d18d1','c9d52dbb-2188-4715-9333-fc1ad82b62d4',5,5,null,true,'#5 general',null,5,true,'MAIN',true),
  ('cf741725-93b8-47f9-89f9-b578ac35dc64','c9d52dbb-2188-4715-9333-fc1ad82b62d4',6,12,null,true,'#6 general',null,6,true,'MAIN',true),
  ('cc03c404-bfa6-403f-b50a-85f548d83737','c9d52dbb-2188-4715-9333-fc1ad82b62d4',7,13,null,true,'#7 general',null,7,true,'MAIN',true),
  ('9b05d8b7-2446-4454-8376-f887f111762e','c9d52dbb-2188-4715-9333-fc1ad82b62d4',8,4,null,true,'#8 general',null,8,true,'MAIN',true),
  ('110f0777-56f9-4922-b224-bc9303f00835','c9d52dbb-2188-4715-9333-fc1ad82b62d4',9,3,null,true,'#9 general',null,9,true,'MAIN',true),
  ('afe9af6d-2afe-45fd-96ac-5ecb5ee8a244','c9d52dbb-2188-4715-9333-fc1ad82b62d4',10,14,null,true,'#10 general',null,10,true,'MAIN',true),
  ('0029ff05-6c91-4148-b118-f1bcef0e84a8','c9d52dbb-2188-4715-9333-fc1ad82b62d4',11,11,null,true,'#11 general',null,11,true,'MAIN',true),
  ('f344795a-85c2-42d2-9a67-f6ff147f1334','c9d52dbb-2188-4715-9333-fc1ad82b62d4',12,6,null,true,'#12 general',null,12,true,'MAIN',true),
  ('9bbf9e30-774d-423c-a4a0-958806fd879b','c9d52dbb-2188-4715-9333-fc1ad82b62d4',13,7,null,true,'#13 general',null,13,true,'MAIN',true),
  ('c7ee9c6e-162e-4a7d-a5aa-a49a0c2fd17c','c9d52dbb-2188-4715-9333-fc1ad82b62d4',14,10,null,true,'#14 general',null,14,true,'MAIN',true);

commit;
