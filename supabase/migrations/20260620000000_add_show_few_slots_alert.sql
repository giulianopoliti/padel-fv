ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS show_few_slots_alert boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tournaments.show_few_slots_alert IS
'Controls whether public tournament cards display the low-capacity alert.';
