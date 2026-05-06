-- Migration: Allow ORGANIZADORES to manage tournament_fechas
-- Date: 2025-09-08
-- Description: Add RLS policy for organizadores to create, update, delete tournament_fechas
--             for tournaments where they have organization access

-- Add new policy for organizadores to manage tournament_fechas
create policy "Organizadores can modify tournament_fechas"
on "public"."tournament_fechas"
as permissive
for all
to authenticated
using (
  -- Check if user is ORGANIZADOR and has access to this tournament's organization
  (
    -- User is ORGANIZADOR
    (SELECT role FROM users WHERE id = auth.uid()) = 'ORGANIZADOR'
    AND
    -- Tournament belongs to an organization that user is member of
    tournament_id IN (
      SELECT t.id 
      FROM tournaments t
      INNER JOIN organization_members om ON om.organizacion_id = t.organization_id
      WHERE om.user_id = auth.uid() 
        AND t.organization_id IS NOT NULL
    )
  )
);