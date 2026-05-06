-- Update RLS policy to allow both 'owner' and 'admin' roles to manage organization clubs

-- Drop the existing policy
DROP POLICY IF EXISTS "Organization owners can manage clubs" ON organization_clubs;

-- Create updated policy that includes both owner and admin roles
CREATE POLICY "Organization owners and admins can manage clubs" ON organization_clubs
FOR ALL USING (
  organizacion_id IN (
    SELECT organizacion_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND member_role IN ('owner', 'admin') 
      AND is_active = true
  )
);