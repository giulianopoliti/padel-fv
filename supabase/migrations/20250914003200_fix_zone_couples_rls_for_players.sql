-- Fix RLS policy for zone_couples to allow player registration
-- This enables players to insert into zone_couples when registering as couples in LONG tournaments

-- Allow players to insert zone assignments for tournaments they have inscriptions in
CREATE POLICY "Players can insert their zone assignments" ON "public"."zone_couples"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (
  -- Solo si el player tiene inscripción en el torneo de esta zona
  EXISTS (
    SELECT 1 FROM inscriptions i 
    JOIN zones z ON z.tournament_id = i.tournament_id
    WHERE z.id = zone_couples.zone_id 
    AND i.player_id IN (
      SELECT p.id FROM players p WHERE p.user_id = auth.uid()
    )
  )
);

-- Allow players to view zone assignments for tournaments they are inscribed in
CREATE POLICY "Players can view their zone assignments" ON "public"."zone_couples"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM inscriptions i 
    JOIN zones z ON z.tournament_id = i.tournament_id
    WHERE z.id = zone_couples.zone_id 
    AND i.player_id IN (
      SELECT p.id FROM players p WHERE p.user_id = auth.uid()
    )
  )
);