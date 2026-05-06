-- Multi-bracket support for LONG Gold/Silver flow
-- Adds bracket_key to bracket persistence artifacts and updates constraints for per-bracket seeding.

-- 1) tournament_couple_seeds
ALTER TABLE public.tournament_couple_seeds
ADD COLUMN IF NOT EXISTS bracket_key text;

UPDATE public.tournament_couple_seeds
SET bracket_key = 'MAIN'
WHERE bracket_key IS NULL;

ALTER TABLE public.tournament_couple_seeds
ALTER COLUMN bracket_key SET DEFAULT 'MAIN';

ALTER TABLE public.tournament_couple_seeds
ALTER COLUMN bracket_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournament_couple_seeds_bracket_key_check'
  ) THEN
    ALTER TABLE public.tournament_couple_seeds
      ADD CONSTRAINT tournament_couple_seeds_bracket_key_check
      CHECK (bracket_key IN ('MAIN', 'GOLD', 'SILVER'));
  END IF;
END
$$;

ALTER TABLE public.tournament_couple_seeds
DROP CONSTRAINT IF EXISTS tournament_couple_seeds_tournament_id_seed_unique;

ALTER TABLE public.tournament_couple_seeds
ADD CONSTRAINT tournament_couple_seeds_tournament_bracket_seed_unique
UNIQUE (tournament_id, bracket_key, seed);

ALTER TABLE public.tournament_couple_seeds
DROP CONSTRAINT IF EXISTS tournament_couple_seeds_placeholder_position_check;

ALTER TABLE public.tournament_couple_seeds
ADD CONSTRAINT tournament_couple_seeds_placeholder_position_check
CHECK ((placeholder_position IS NULL) OR (placeholder_position >= 1 AND placeholder_position <= 64));

CREATE INDEX IF NOT EXISTS idx_tournament_couple_seeds_tournament_bracket
ON public.tournament_couple_seeds (tournament_id, bracket_key);

-- 2) matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS bracket_key text;

UPDATE public.matches
SET bracket_key = 'MAIN'
WHERE bracket_key IS NULL;

ALTER TABLE public.matches
ALTER COLUMN bracket_key SET DEFAULT 'MAIN';

ALTER TABLE public.matches
ALTER COLUMN bracket_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_bracket_key_check'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_bracket_key_check
      CHECK (bracket_key IN ('MAIN', 'GOLD', 'SILVER'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_matches_tournament_type_bracket
ON public.matches (tournament_id, type, bracket_key);

-- 3) match_hierarchy
ALTER TABLE public.match_hierarchy
ADD COLUMN IF NOT EXISTS bracket_key text;

UPDATE public.match_hierarchy
SET bracket_key = 'MAIN'
WHERE bracket_key IS NULL;

ALTER TABLE public.match_hierarchy
ALTER COLUMN bracket_key SET DEFAULT 'MAIN';

ALTER TABLE public.match_hierarchy
ALTER COLUMN bracket_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_hierarchy_bracket_key_check'
  ) THEN
    ALTER TABLE public.match_hierarchy
      ADD CONSTRAINT match_hierarchy_bracket_key_check
      CHECK (bracket_key IN ('MAIN', 'GOLD', 'SILVER'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_match_hierarchy_tournament_bracket
ON public.match_hierarchy (tournament_id, bracket_key);

-- 4) placeholder_resolutions
ALTER TABLE public.placeholder_resolutions
ADD COLUMN IF NOT EXISTS bracket_key text;

UPDATE public.placeholder_resolutions
SET bracket_key = 'MAIN'
WHERE bracket_key IS NULL;

ALTER TABLE public.placeholder_resolutions
ALTER COLUMN bracket_key SET DEFAULT 'MAIN';

ALTER TABLE public.placeholder_resolutions
ALTER COLUMN bracket_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'placeholder_resolutions_bracket_key_check'
  ) THEN
    ALTER TABLE public.placeholder_resolutions
      ADD CONSTRAINT placeholder_resolutions_bracket_key_check
      CHECK (bracket_key IN ('MAIN', 'GOLD', 'SILVER'));
  END IF;
END
$$;

ALTER TABLE public.placeholder_resolutions
DROP CONSTRAINT IF EXISTS placeholder_resolutions_zone_position_check;

ALTER TABLE public.placeholder_resolutions
ADD CONSTRAINT placeholder_resolutions_zone_position_check
CHECK (zone_position >= 1 AND zone_position <= 64);

CREATE INDEX IF NOT EXISTS idx_placeholder_resolutions_tournament_bracket
ON public.placeholder_resolutions (tournament_id, bracket_key);
