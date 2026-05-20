-- Allow tournament prices above the smallint ceiling (32767).
ALTER TABLE public.tournaments
DROP CONSTRAINT IF EXISTS tournaments_price_check;

ALTER TABLE public.tournaments
ALTER COLUMN price TYPE integer
USING (
  CASE
    WHEN price IS NULL THEN NULL
    WHEN trim(price::text) = '' THEN NULL
    WHEN regexp_replace(price::text, '[^0-9]', '', 'g') = '' THEN NULL
    ELSE regexp_replace(price::text, '[^0-9]', '', 'g')::integer
  END
);

ALTER TABLE public.tournaments
ADD CONSTRAINT tournaments_price_check CHECK (price IS NULL OR price >= 0);

COMMENT ON COLUMN public.tournaments.price IS 'Entry price for the tournament in whole currency units.';
