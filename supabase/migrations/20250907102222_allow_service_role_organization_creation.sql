-- Add a policy that allows service role to create organizations during registration
-- This is needed because during registration, the service role is used for database operations

DROP POLICY IF EXISTS "Allow organization creation during registration" ON organizaciones;

-- Create a policy that allows both authenticated users and service role
CREATE POLICY "Allow organization creation" 
ON organizaciones 
FOR INSERT 
TO public
WITH CHECK (
  -- Allow if user is authenticated OR if this is a service role operation
  auth.uid() IS NOT NULL OR 
  current_setting('role') = 'service_role' OR
  current_user = 'service_role'
);