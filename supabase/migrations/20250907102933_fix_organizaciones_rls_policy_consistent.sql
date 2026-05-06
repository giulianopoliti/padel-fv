-- Fix organizaciones RLS policy to be consistent with players and clubes
-- Drop the complex policy that was causing issues
DROP POLICY IF EXISTS "Allow organization creation" ON organizaciones;

-- Create a simple policy identical to players and clubes
CREATE POLICY "organizaciones_app_managed_insert" 
ON organizaciones 
FOR INSERT 
TO public 
WITH CHECK (true);