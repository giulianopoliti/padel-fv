-- Drop and recreate the INSERT policy for organizaciones to be more permissive during registration
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizaciones;

-- Create a more permissive policy that allows authenticated users to create organizations
CREATE POLICY "Allow organization creation during registration" 
ON organizaciones 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Always allow authenticated users to create organizations
  auth.uid() IS NOT NULL
);