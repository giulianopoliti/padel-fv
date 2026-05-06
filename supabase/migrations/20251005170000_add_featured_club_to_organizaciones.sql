-- Migration: Add featured_club_id to organizaciones table
-- Description: Allows organizations to select a featured club to highlight in their profile/cards

-- Add featured_club_id column to organizaciones table
ALTER TABLE organizaciones
ADD COLUMN featured_club_id uuid REFERENCES clubes(id) ON DELETE SET NULL;

-- Add comment to the column
COMMENT ON COLUMN organizaciones.featured_club_id IS 'Reference to the featured/highlighted club for this organization. Nullable - organizations can choose to highlight one of their clubs.';

-- Create index for faster queries when filtering by featured club
CREATE INDEX idx_organizaciones_featured_club ON organizaciones(featured_club_id) WHERE featured_club_id IS NOT NULL;

-- Add constraint to ensure featured club belongs to the organization
-- This will be enforced at application level through the UI, but we document it here
COMMENT ON CONSTRAINT organizaciones_featured_club_id_fkey ON organizaciones IS 'Featured club must be one of the clubs associated with this organization (validated at application level)';
