-- Fix the recursive ALL policy that was causing the infinite recursion
-- Drop the problematic ALL policy
DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;

-- Create separate, non-recursive policies for UPDATE and DELETE
-- UPDATE policy: owners can update members
CREATE POLICY "organization_members_owner_update" 
ON organization_members 
FOR UPDATE 
TO authenticated
USING (
  -- Only allow update if user is owner of the organization
  EXISTS (
    SELECT 1 FROM organizaciones org 
    JOIN users u ON u.id = auth.uid()
    WHERE org.id = organizacion_id 
    AND u.role = 'ORGANIZADOR'
  )
);

-- DELETE policy: owners can delete members  
CREATE POLICY "organization_members_owner_delete" 
ON organization_members 
FOR DELETE 
TO authenticated
USING (
  -- Only allow delete if user is owner of the organization
  EXISTS (
    SELECT 1 FROM organizaciones org 
    JOIN users u ON u.id = auth.uid()
    WHERE org.id = organizacion_id 
    AND u.role = 'ORGANIZADOR'
  )
);