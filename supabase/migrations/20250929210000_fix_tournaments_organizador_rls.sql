-- Fix tournaments RLS policies for ORGANIZADOR role
-- This migration adds missing RLS policies for organizadores to manage tournaments
-- Based on the logic in utils/tournament-permissions.ts

-- Add policy for organizadores to create tournaments
CREATE POLICY "Organizadores can create tournaments"
ON "public"."tournaments"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is ORGANIZADOR
  (SELECT role FROM users WHERE id = auth.uid()) = 'ORGANIZADOR'
  AND
  -- If organization_id is provided, user must be member of that organization
  (
    organization_id IS NULL
    OR
    organization_id IN (
      SELECT om.organizacion_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
    )
  )
);

-- Add policy for organizadores to update tournaments
CREATE POLICY "Organizadores can update tournaments"
ON "public"."tournaments"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  -- User is ORGANIZADOR and tournament belongs to their organization
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ORGANIZADOR'
    AND
    organization_id IN (
      SELECT om.organizacion_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
    )
  )
);

-- Add policy for organizadores to delete tournaments
CREATE POLICY "Organizadores can delete tournaments"
ON "public"."tournaments"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  -- User is ORGANIZADOR and tournament belongs to their organization
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ORGANIZADOR'
    AND
    organization_id IN (
      SELECT om.organizacion_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
    )
  )
);