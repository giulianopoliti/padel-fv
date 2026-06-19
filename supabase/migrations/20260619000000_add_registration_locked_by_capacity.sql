alter table public.tournaments
add column if not exists registration_locked_by_capacity boolean not null default false;

comment on column public.tournaments.registration_locked_by_capacity is
  'Whether registrations were automatically locked because the tournament reached max_participants.';
