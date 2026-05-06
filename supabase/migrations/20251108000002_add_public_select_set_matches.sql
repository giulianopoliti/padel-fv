-- Add public SELECT policy for set_matches table
-- This allows anyone (including non-authenticated users) to view set match details
-- but they cannot insert, update, or delete data

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Public can view set_matches" ON set_matches;

-- Create new public SELECT policy
CREATE POLICY "Public can view set_matches"
ON set_matches
FOR SELECT
TO anon, authenticated
USING (true);

-- Add comment for documentation
COMMENT ON POLICY "Public can view set_matches" ON set_matches IS
'Allows public (anonymous and authenticated users) to view set match details for transparency. Write operations remain restricted to club owners and organizers.';
