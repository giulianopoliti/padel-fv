-- Aplica el resultado real del partido pendiente de Zona B del repro c9d52.
-- Estado final real:
-- Pablo Rossi / Marcelo Diciancia 5 - 6 Adrian Anolles / Maximiliano Mantesi

update matches
set
  result_couple1 = '5',
  result_couple2 = '6',
  winner_id = 'be2db29c-c8c9-4937-b91d-e48582b3c388',
  status = 'FINISHED'
where id = '8bd81fdb-9f7d-4e71-8e14-27ceeb9b74ec'
  and tournament_id = 'c9d52dbb-2188-4715-9333-fc1ad82b62d4';
