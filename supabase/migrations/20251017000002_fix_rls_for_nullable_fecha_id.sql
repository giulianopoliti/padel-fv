-- Fix RLS policy for fecha_matches to support NULL fecha_id (bracket matches)
-- The previous policy only checked fecha_id, but bracket matches can have fecha_id = NULL
-- We need to check permissions via the match's tournament_id instead

DROP POLICY IF EXISTS "Club owners and organizers can modify fecha_matches" ON fecha_matches;

-- New policy that handles both:
-- 1. fecha_id NOT NULL: check permissions via tournament_fechas (zone matches)
-- 2. fecha_id IS NULL: check permissions via matches.tournament_id (bracket matches)
CREATE POLICY "Club owners and organizers can modify fecha_matches" ON fecha_matches
FOR ALL USING (
  -- Option A: fecha_id is NOT NULL (zone matches) - check via tournament_fechas
  (
    fecha_id IS NOT NULL
    AND fecha_id IN (
      SELECT tf.id FROM tournament_fechas tf
      JOIN tournaments t ON tf.tournament_id = t.id
      WHERE
        -- Club owners
        t.club_id IN (
          SELECT clubes.id FROM clubes WHERE clubes.user_id = auth.uid()
        )
        OR
        -- Organizers
        t.organization_id IN (
          SELECT om.organizacion_id
          FROM organization_members om
          WHERE om.user_id = auth.uid() AND om.is_active = true
        )
    )
  )
  OR
  -- Option B: fecha_id IS NULL (bracket matches) - check via matches.tournament_id
  (
    fecha_id IS NULL
    AND match_id IN (
      SELECT m.id FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE
        -- Club owners
        t.club_id IN (
          SELECT clubes.id FROM clubes WHERE clubes.user_id = auth.uid()
        )
        OR
        -- Organizers
        t.organization_id IN (
          SELECT om.organizacion_id
          FROM organization_members om
          WHERE om.user_id = auth.uid() AND om.is_active = true
        )
    )
  )
);

COMMENT ON POLICY "Club owners and organizers can modify fecha_matches" ON fecha_matches IS
'Allows club owners and organizers to modify fecha_matches. Supports both zone matches (fecha_id NOT NULL) and bracket matches (fecha_id IS NULL).';
