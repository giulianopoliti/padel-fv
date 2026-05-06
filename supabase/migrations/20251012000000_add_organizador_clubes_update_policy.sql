-- Add RLS policy to allow ORGANIZADOR users to update clubs that belong to their organization
-- This enables organizers to upload images and update club data for clubs associated with their organization

-- Drop existing policy if it exists (in case we're re-running)
DROP POLICY IF EXISTS "organizadores_can_update_their_clubs" ON "public"."clubes";

-- Create policy that allows ORGANIZADOR users to UPDATE clubs that are associated with their organization
CREATE POLICY "organizadores_can_update_their_clubs"
ON "public"."clubes"
FOR UPDATE
USING (
  -- Allow if the user is an ORGANIZADOR and the club is associated with their organization
  EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN organization_clubs oc ON oc.organizacion_id = om.organizacion_id
    WHERE om.user_id = auth.uid()
      AND om.member_role IN ('owner', 'admin')
      AND om.is_active = true
      AND oc.club_id = clubes.id
  )
);

-- Comment explaining the policy
COMMENT ON POLICY "organizadores_can_update_their_clubs" ON "public"."clubes" IS
'Allows ORGANIZADOR users (owners/admins) to update clubs that are associated with their organization via organization_clubs table';
