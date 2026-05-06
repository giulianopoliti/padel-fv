-- Add organization_id field to tournaments table
-- This column is referenced by multiple RLS policies but was missing from the schema

ALTER TABLE tournaments
ADD COLUMN organization_id UUID REFERENCES organizaciones(id);

-- Add index for performance on organization queries
CREATE INDEX IF NOT EXISTS idx_tournaments_organization_id
ON tournaments(organization_id);

-- Add comment to document the field purpose
COMMENT ON COLUMN tournaments.organization_id IS 'Reference to organization that owns this tournament. Used by RLS policies for organizador access control';