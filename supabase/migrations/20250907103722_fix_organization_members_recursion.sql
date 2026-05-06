-- Fix the infinite recursion in organization_members policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can create organization membership during registration" ON organization_members;

-- Create a simple policy like players/clubes - no subconsultas
CREATE POLICY "organization_members_simple_insert" 
ON organization_members 
FOR INSERT 
TO public
WITH CHECK (true);