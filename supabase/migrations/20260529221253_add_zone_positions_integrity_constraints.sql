alter table public.zone_positions
  add constraint zone_positions_required_ids_check
  check (
    tournament_id is not null
    and zone_id is not null
    and couple_id is not null
  ) not valid;

alter table public.zone_positions
  validate constraint zone_positions_required_ids_check;

alter table public.zone_positions
  add constraint zone_positions_tournament_zone_couple_unique
  unique (tournament_id, zone_id, couple_id);

alter table public.zone_positions
  add constraint zone_positions_inscription_fk
  foreign key (tournament_id, couple_id)
  references public.inscriptions (tournament_id, couple_id)
  on delete cascade
  not valid;

alter table public.zone_positions
  validate constraint zone_positions_inscription_fk;
