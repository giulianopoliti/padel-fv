-- Ensure RLS policies work for organization registration
-- The issue might be with the service role or timing of authentication

-- Add a more permissive INSERT policy for organization_members during registration
DROP POLICY IF EXISTS "Users can create their own organization membership" ON organization_members;

CREATE POLICY "Users can create organization membership during registration" 
ON organization_members 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Allow if user is creating membership for themselves
  user_id = auth.uid() OR
  -- Or if no existing membership exists for this user (registration case)
  NOT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid()
  )
);