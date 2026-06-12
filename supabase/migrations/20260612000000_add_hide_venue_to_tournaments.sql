ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS hide_venue boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tournaments.hide_venue IS
'Oculta club/sede en vistas publicas y de jugador del torneo.';
