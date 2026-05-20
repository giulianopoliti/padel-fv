CREATE TABLE IF NOT EXISTS public.tournament_couple_disqualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES public.players(id),
  player2_id uuid NOT NULL REFERENCES public.players(id),
  phase text NOT NULL CHECK (phase IN ('ZONE_PHASE', 'BRACKET_PHASE')),
  round public."ROUND",
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  reason text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVERTED')),
  disqualified_by uuid REFERENCES auth.users(id),
  disqualified_at timestamp with time zone NOT NULL DEFAULT now(),
  reverted_by uuid REFERENCES auth.users(id),
  reverted_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_couple_disqualifications_revert_consistency CHECK (
    (status = 'ACTIVE' AND reverted_at IS NULL)
    OR
    (status = 'REVERTED' AND reverted_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_tournament_couple_disqualification
  ON public.tournament_couple_disqualifications(tournament_id, couple_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_tournament_couple_disqualifications_tournament_status
  ON public.tournament_couple_disqualifications(tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tournament_couple_disqualifications_match_status
  ON public.tournament_couple_disqualifications(match_id, status)
  WHERE match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_couple_disqualifications_players
  ON public.tournament_couple_disqualifications(player1_id, player2_id);

ALTER TABLE public.tournament_couple_disqualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tournament couple disqualifications"
  ON public.tournament_couple_disqualifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage tournament couple disqualifications"
  ON public.tournament_couple_disqualifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
