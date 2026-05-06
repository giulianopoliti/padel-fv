-- Fix set_matches RLS policies to be consistent with other tournament tables
-- The current policies are too permissive (allow ANY authenticated user)
-- We need to restrict to club owners and organizers of the specific tournament

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to modify set_matches" ON set_matches;
DROP POLICY IF EXISTS "Allow authenticated users to read set_matches" ON set_matches;

-- Create proper restrictive policies that check tournament ownership/organization
-- SELECT policy - allow reading if user has access to the tournament
CREATE POLICY "Club owners and organizers can read set_matches" ON set_matches
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = set_matches.match_id
    AND (
      -- Club owner
      t.club_id IN (SELECT id FROM clubes WHERE user_id = auth.uid())
      OR
      -- Organization member (organizador)
      t.organization_id IN (SELECT organizacion_id FROM organization_members WHERE user_id = auth.uid())
    )
  )
);

-- INSERT policy - allow inserting if user has access to the tournament
CREATE POLICY "Club owners and organizers can create set_matches" ON set_matches
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = set_matches.match_id
    AND (
      -- Club owner
      t.club_id IN (SELECT id FROM clubes WHERE user_id = auth.uid())
      OR
      -- Organization member (organizador)
      t.organization_id IN (SELECT organizacion_id FROM organization_members WHERE user_id = auth.uid())
    )
  )
);

-- UPDATE policy - allow updating if user has access to the tournament
CREATE POLICY "Club owners and organizers can update set_matches" ON set_matches
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = set_matches.match_id
    AND (
      -- Club owner
      t.club_id IN (SELECT id FROM clubes WHERE user_id = auth.uid())
      OR
      -- Organization member (organizador)
      t.organization_id IN (SELECT organizacion_id FROM organization_members WHERE user_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = set_matches.match_id
    AND (
      -- Club owner
      t.club_id IN (SELECT id FROM clubes WHERE user_id = auth.uid())
      OR
      -- Organization member (organizador)
      t.organization_id IN (SELECT organizacion_id FROM organization_members WHERE user_id = auth.uid())
    )
  )
);

-- DELETE policy - allow deleting if user has access to the tournament
CREATE POLICY "Club owners and organizers can delete set_matches" ON set_matches
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = set_matches.match_id
    AND (
      -- Club owner
      t.club_id IN (SELECT id FROM clubes WHERE user_id = auth.uid())
      OR
      -- Organization member (organizador)
      t.organization_id IN (SELECT organizacion_id FROM organization_members WHERE user_id = auth.uid())
    )
  )
);