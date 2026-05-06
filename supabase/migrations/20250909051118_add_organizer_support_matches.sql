-- Actualizar RLS policies para matches: incluir organizadores
-- BACKUP: Guardar policies existentes comentadas para rollback

-- 1. Actualizar DELETE policy
DROP POLICY IF EXISTS "matches_club_delete" ON matches;
CREATE POLICY "Club owners and organizers can delete matches" ON matches
FOR DELETE USING (
  tournament_id IN (
    SELECT t.id FROM tournaments t WHERE 
      -- Club owners (lógica existente)
      t.club_id IN (
        SELECT c.id FROM clubes c WHERE c.user_id = auth.uid()
      )
      OR
      -- Organizers (nueva lógica simple)
      t.organization_id IN (
        SELECT om.organizacion_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid() AND om.is_active = true
      )
  )
);

-- 2. Actualizar UPDATE policy  
DROP POLICY IF EXISTS "matches_club_update" ON matches;
CREATE POLICY "Club owners and organizers can update matches" ON matches
FOR UPDATE USING (
  tournament_id IN (
    SELECT t.id FROM tournaments t WHERE 
      -- Club owners (lógica existente)
      t.club_id IN (
        SELECT c.id FROM clubes c WHERE c.user_id = auth.uid()
      )
      OR
      -- Organizers (nueva lógica simple)
      t.organization_id IN (
        SELECT om.organizacion_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid() AND om.is_active = true
      )
  )
);

-- BACKUP policies originales para rollback:
-- matches_club_delete original:
-- CREATE POLICY "matches_club_delete" ON matches FOR DELETE USING (auth.uid() IN (SELECT c.user_id FROM (clubes c JOIN tournaments t ON ((c.id = t.club_id))) WHERE (t.id = matches.tournament_id)));

-- matches_club_update original:  
-- CREATE POLICY "matches_club_update" ON matches FOR UPDATE USING (auth.uid() IN (SELECT c.user_id FROM (clubes c JOIN tournaments t ON ((c.id = t.club_id))) WHERE (t.id = matches.tournament_id)));