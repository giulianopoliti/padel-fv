alter table public.tournaments
add column if not exists messages_enabled boolean not null default true;

comment on column public.tournaments.messages_enabled is
'When enabled, tournament lifecycle messages are sent through the configured messaging channels.';
