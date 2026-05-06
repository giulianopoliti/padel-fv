-- Create clubes_tournament junction table to track tournament-club relationships
-- This table normalizes the many-to-many relationship between tournaments and clubs
-- A tournament can be hosted at multiple clubs

CREATE TABLE IF NOT EXISTS "public"."clubes_tournament" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL REFERENCES "public"."tournaments"("id") ON DELETE CASCADE,
    "club_id" UUID NOT NULL REFERENCES "public"."clubes"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

    -- Ensure a tournament-club pair is unique (no duplicates)
    CONSTRAINT "unique_tournament_club" UNIQUE("tournament_id", "club_id")
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS "idx_clubes_tournament_tournament_id"
ON "public"."clubes_tournament"("tournament_id");

CREATE INDEX IF NOT EXISTS "idx_clubes_tournament_club_id"
ON "public"."clubes_tournament"("club_id");

-- Add composite index for common join queries
CREATE INDEX IF NOT EXISTS "idx_clubes_tournament_tournament_club"
ON "public"."clubes_tournament"("tournament_id", "club_id");

-- Add table and column comments for documentation
COMMENT ON TABLE "public"."clubes_tournament" IS 'Junction table linking tournaments with their associated clubs. Supports many-to-many relationships - a tournament can be hosted at multiple clubs.';
COMMENT ON COLUMN "public"."clubes_tournament"."tournament_id" IS 'Reference to the tournament';
COMMENT ON COLUMN "public"."clubes_tournament"."club_id" IS 'Reference to the club hosting or associated with the tournament';
COMMENT ON COLUMN "public"."clubes_tournament"."created_at" IS 'Timestamp when the relationship was created';
COMMENT ON COLUMN "public"."clubes_tournament"."updated_at" IS 'Timestamp when the relationship was last updated';

-- Enable Row Level Security (RLS)
ALTER TABLE "public"."clubes_tournament" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read all clubes_tournament records
CREATE POLICY "Allow authenticated users to read clubes_tournament"
ON "public"."clubes_tournament"
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Allow club owners to insert their own clubs
CREATE POLICY "Allow club owners to insert their own clubs"
ON "public"."clubes_tournament"
FOR INSERT
TO authenticated
WITH CHECK (
    -- Club owner can add their own club to any tournament
    EXISTS (
        SELECT 1
        FROM "public"."clubes" c
        WHERE c.id = club_id
        AND c.user_id = auth.uid()
    )
);

-- RLS Policy: Allow organizadores to insert clubs from their organization
CREATE POLICY "Allow organizadores to insert clubs from their organization"
ON "public"."clubes_tournament"
FOR INSERT
TO authenticated
WITH CHECK (
    -- Organizador can add club if:
    -- 1. They are member of an organization (via organization_members)
    -- 2. The tournament belongs to that organization (via tournaments.organization_id)
    -- 3. The club belongs to that organization (via organization_clubs)
    EXISTS (
        SELECT 1
        FROM "public"."tournaments" t
        JOIN "public"."organization_members" om ON om.organizacion_id = t.organization_id
        JOIN "public"."organization_clubs" oc ON oc.organizacion_id = t.organization_id
        WHERE t.id = tournament_id
        AND oc.club_id = clubes_tournament.club_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

-- RLS Policy: Allow service role full access (for scripts and admin operations)
CREATE POLICY "Allow service role full access to clubes_tournament"
ON "public"."clubes_tournament"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policy: Allow club owners to update/delete their own clubs
CREATE POLICY "Allow club owners to update delete their own clubs"
ON "public"."clubes_tournament"
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM "public"."clubes" c
        WHERE c.id = club_id
        AND c.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM "public"."clubes" c
        WHERE c.id = club_id
        AND c.user_id = auth.uid()
    )
);

-- RLS Policy: Allow organizadores to update/delete clubs from their organization
CREATE POLICY "Allow organizadores to update delete clubs from their organization"
ON "public"."clubes_tournament"
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM "public"."tournaments" t
        JOIN "public"."organization_members" om ON om.organizacion_id = t.organization_id
        JOIN "public"."organization_clubs" oc ON oc.organizacion_id = t.organization_id
        WHERE t.id = tournament_id
        AND oc.club_id = clubes_tournament.club_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM "public"."tournaments" t
        JOIN "public"."organization_members" om ON om.organizacion_id = t.organization_id
        JOIN "public"."organization_clubs" oc ON oc.organizacion_id = t.organization_id
        WHERE t.id = tournament_id
        AND oc.club_id = clubes_tournament.club_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
    )
);

-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."update_clubes_tournament_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before each update
CREATE TRIGGER "trigger_update_clubes_tournament_updated_at"
BEFORE UPDATE ON "public"."clubes_tournament"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_clubes_tournament_updated_at"();
