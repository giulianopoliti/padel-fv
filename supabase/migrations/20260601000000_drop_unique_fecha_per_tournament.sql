-- Allow duplicate fecha_number per tournament (numbers are display-only, gaps are OK)

ALTER TABLE public.tournament_fechas
  DROP CONSTRAINT IF EXISTS unique_fecha_per_tournament;

COMMENT ON COLUMN public.tournament_fechas.fecha_number IS
  'Número de fecha dentro del torneo (puede repetirse o tener huecos; no es identificador único).';