ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS dni_is_temporary boolean NOT NULL DEFAULT false;

UPDATE public.players
SET
  dni = NULLIF(regexp_replace(COALESCE(dni, ''), '\D', '', 'g'), ''),
  dni_is_temporary = CASE
    WHEN NULLIF(regexp_replace(COALESCE(dni, ''), '\D', '', 'g'), '') IS NULL THEN true
    ELSE false
  END;
