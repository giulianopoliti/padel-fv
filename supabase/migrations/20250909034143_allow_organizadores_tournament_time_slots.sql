-- Migration: Allow ORGANIZADORES to manage tournament_time_slots
-- Date: 2025-09-08
-- Description: Add RLS policy for organizadores to create, update, delete tournament_time_slots
--             for tournaments where they have organization access

-- Add new policy for organizadores to manage tournament_time_slots
create policy "Organizadores can modify tournament_time_slots"
on "public"."tournament_time_slots"
as permissive
for all
to authenticated
using (
  -- Check if user is ORGANIZADOR and has access to this tournament's organization
  (
    -- User is ORGANIZADOR
    (SELECT role FROM users WHERE id = auth.uid()) = 'ORGANIZADOR'
    AND
    -- Time slot belongs to a fecha of a tournament in user's organization
    fecha_id IN (
      SELECT tf.id 
      FROM tournament_fechas tf
      INNER JOIN tournaments t ON t.id = tf.tournament_id
      INNER JOIN organization_members om ON om.organizacion_id = t.organization_id
      WHERE om.user_id = auth.uid() 
        AND t.organization_id IS NOT NULL
    )
  )
);