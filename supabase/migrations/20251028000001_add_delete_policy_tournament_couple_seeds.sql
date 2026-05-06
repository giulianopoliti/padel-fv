-- Migration: Add DELETE policy for tournament_couple_seeds table
-- Date: 2025-10-28
-- Description: Adds RLS policy to allow club owners and organizadores to delete tournament couple seeds

-- This policy follows the same pattern as other tournament-related tables (matches, tournaments)
-- It allows DELETE operations to:
-- 1. Club owners (users who own the club via club_id)
-- 2. Organizadores (users who are active members of the organization via organization_id)

CREATE POLICY "tournament_couple_seeds_club_organizador_delete"
ON "public"."tournament_couple_seeds"
AS PERMISSIVE
FOR DELETE
TO public
USING (
  -- Check if the user can delete seeds from this tournament
  tournament_id IN (
    SELECT t.id
    FROM tournaments t
    WHERE
      -- Club owner check: user owns the club that created the tournament
      t.club_id IN (
        SELECT c.id
        FROM clubes c
        WHERE c.user_id = auth.uid()
      )
      OR
      -- Organizador check: user is an active member of the organization that owns the tournament
      t.organization_id IN (
        SELECT om.organizacion_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
          AND om.is_active = true
      )
  )
);

-- Add comment for documentation
COMMENT ON POLICY "tournament_couple_seeds_club_organizador_delete" ON "public"."tournament_couple_seeds"
IS 'Allows club owners and active organization members to delete tournament couple seeds from their tournaments';
