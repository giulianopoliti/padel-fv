-- Add bracket scope support to tournament_fechas for LONG Gold/Silver schedule management
-- Scope rule: one fecha belongs to one bracket key (MAIN | GOLD | SILVER)

ALTER TABLE public.tournament_fechas
ADD COLUMN IF NOT EXISTS bracket_key text;

UPDATE public.tournament_fechas
SET bracket_key = 'MAIN'
WHERE bracket_key IS NULL;

ALTER TABLE public.tournament_fechas
ALTER COLUMN bracket_key SET DEFAULT 'MAIN';

ALTER TABLE public.tournament_fechas
ALTER COLUMN bracket_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournament_fechas_bracket_key_check'
  ) THEN
    ALTER TABLE public.tournament_fechas
      ADD CONSTRAINT tournament_fechas_bracket_key_check
      CHECK (bracket_key IN ('MAIN', 'GOLD', 'SILVER'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournament_fechas_zone_round_main_bracket_check'
  ) THEN
    ALTER TABLE public.tournament_fechas
      ADD CONSTRAINT tournament_fechas_zone_round_main_bracket_check
      CHECK (round_type <> 'ZONE' OR bracket_key = 'MAIN');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tournament_fechas_tournament_round_bracket
ON public.tournament_fechas (tournament_id, round_type, bracket_key);
