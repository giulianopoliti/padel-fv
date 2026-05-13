-- Add automatic "FECHA LIBRE" system slots for LONG tournament fechas.
-- A FREE_DATE slot represents a full-fecha unavailability marker, not a playable time range.

ALTER TABLE public.tournament_time_slots
ADD COLUMN IF NOT EXISTS slot_type text NOT NULL DEFAULT 'TIME_RANGE';

ALTER TABLE public.tournament_time_slots
ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournament_time_slots_slot_type_check'
  ) THEN
    ALTER TABLE public.tournament_time_slots
      ADD CONSTRAINT tournament_time_slots_slot_type_check
      CHECK (slot_type IN ('TIME_RANGE', 'FREE_DATE'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_time_slots_one_free_date_per_fecha
ON public.tournament_time_slots (fecha_id)
WHERE slot_type = 'FREE_DATE';

CREATE INDEX IF NOT EXISTS idx_tournament_time_slots_fecha_slot_type
ON public.tournament_time_slots (fecha_id, slot_type);

COMMENT ON COLUMN public.tournament_time_slots.slot_type IS
  'TIME_RANGE for playable schedule slots, FREE_DATE for full-fecha unavailability markers';

COMMENT ON COLUMN public.tournament_time_slots.is_system IS
  'True for slots created automatically by the system and not editable by organizers';

CREATE OR REPLACE FUNCTION public.ensure_free_date_time_slot(p_fecha_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_date date;
BEGIN
  SELECT COALESCE(tf.start_date, tf.end_date, CURRENT_DATE)
  INTO v_slot_date
  FROM public.tournament_fechas tf
  JOIN public.tournaments t ON t.id = tf.tournament_id
  WHERE tf.id = p_fecha_id
    AND t.type = 'LONG';

  IF v_slot_date IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.tournament_time_slots (
    fecha_id,
    date,
    start_time,
    end_time,
    court_name,
    max_matches,
    description,
    is_available,
    slot_type,
    is_system
  )
  SELECT
    p_fecha_id,
    v_slot_date,
    '00:00'::time,
    '23:59'::time,
    'FECHA LIBRE',
    0,
    'FECHA LIBRE',
    true,
    'FREE_DATE',
    true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.tournament_time_slots
    WHERE fecha_id = p_fecha_id
      AND slot_type = 'FREE_DATE'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_free_date_time_slot_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_free_date_time_slot(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_fechas_ensure_free_date_slot ON public.tournament_fechas;

CREATE TRIGGER trg_tournament_fechas_ensure_free_date_slot
AFTER INSERT OR UPDATE OF tournament_id, start_date, end_date
ON public.tournament_fechas
FOR EACH ROW
EXECUTE FUNCTION public.ensure_free_date_time_slot_trigger();

SELECT public.ensure_free_date_time_slot(tf.id)
FROM public.tournament_fechas tf
JOIN public.tournaments t ON t.id = tf.tournament_id
WHERE t.type = 'LONG';
