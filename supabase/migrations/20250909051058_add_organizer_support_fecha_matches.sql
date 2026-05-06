-- Actualizar RLS policy para fecha_matches: incluir organizadores
-- BACKUP: Guardar policy existente comentada para rollback

-- DROP la policy existente
DROP POLICY IF EXISTS "Club owners can modify fecha_matches" ON fecha_matches;

-- CREAR nueva policy que incluye clubes Y organizadores
CREATE POLICY "Club owners and organizers can modify fecha_matches" ON fecha_matches
FOR ALL USING (
  fecha_id IN (
    SELECT tf.id FROM tournament_fechas tf 
    JOIN tournaments t ON tf.tournament_id = t.id 
    WHERE 
      -- Club owners (lógica existente)
      t.club_id IN (
        SELECT clubes.id FROM clubes WHERE clubes.user_id = auth.uid()
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

-- BACKUP policy original para rollback si es necesario:
-- CREATE POLICY "Club owners can modify fecha_matches" ON fecha_matches
-- FOR ALL USING (
--   fecha_id IN (
--     SELECT tf.id FROM tournament_fechas tf 
--     JOIN tournaments t ON tf.tournament_id = t.id 
--     WHERE t.club_id IN (
--       SELECT clubes.id FROM clubes WHERE clubes.user_id = auth.uid()
--     )
--   )
-- );