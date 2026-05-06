-- Fix RLS policies for zone_couples, zones, and zone_positions to include organizers
-- This migration updates the row-level security policies to allow organizers
-- (users in organization_members) to manage zones and zone-related data

-- =============================================
-- ZONE_COUPLES POLICIES UPDATE
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "zone_couples_club_manage" ON "public"."zone_couples";
DROP POLICY IF EXISTS "zone_couples_club_update" ON "public"."zone_couples";
DROP POLICY IF EXISTS "zone_couples_club_delete" ON "public"."zone_couples";

-- Create new policies that include organizers
CREATE POLICY "zone_couples_club_and_org_manage" ON "public"."zone_couples"
    FOR INSERT
    WITH CHECK (
        -- Club owners can manage
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
        )
        OR
        -- Organizers can manage
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zone_couples_club_and_org_update" ON "public"."zone_couples"
    FOR UPDATE
    USING (
        -- Club owners can update
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
        )
        OR
        -- Organizers can update
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zone_couples_club_and_org_delete" ON "public"."zone_couples"
    FOR DELETE
    USING (
        -- Club owners can delete
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
        )
        OR
        -- Organizers can delete
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_couples.zone_id
            AND om.is_active = true
        )
    );

-- =============================================
-- ZONES POLICIES UPDATE
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "zones_club_manage" ON "public"."zones";
DROP POLICY IF EXISTS "zones_club_update" ON "public"."zones";
DROP POLICY IF EXISTS "zones_club_delete" ON "public"."zones";

-- Create new policies that include organizers
CREATE POLICY "zones_club_and_org_manage" ON "public"."zones"
    FOR INSERT
    WITH CHECK (
        -- Club owners can manage
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            WHERE t.id = zones.tournament_id
        )
        OR
        -- Organizers can manage
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            WHERE t.id = zones.tournament_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zones_club_and_org_update" ON "public"."zones"
    FOR UPDATE
    USING (
        -- Club owners can update
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            WHERE t.id = zones.tournament_id
        )
        OR
        -- Organizers can update
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            WHERE t.id = zones.tournament_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zones_club_and_org_delete" ON "public"."zones"
    FOR DELETE
    USING (
        -- Club owners can delete
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            WHERE t.id = zones.tournament_id
        )
        OR
        -- Organizers can delete
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            WHERE t.id = zones.tournament_id
            AND om.is_active = true
        )
    );

-- =============================================
-- ZONE_POSITIONS POLICIES UPDATE
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "zone_positions_club_manage" ON "public"."zone_positions";
DROP POLICY IF EXISTS "zone_positions_club_update" ON "public"."zone_positions";
DROP POLICY IF EXISTS "zone_positions_club_delete" ON "public"."zone_positions";

-- Create new policies that include organizers
CREATE POLICY "zone_positions_club_and_org_manage" ON "public"."zone_positions"
    FOR INSERT
    WITH CHECK (
        -- Club owners can manage
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
        )
        OR
        -- Organizers can manage
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zone_positions_club_and_org_update" ON "public"."zone_positions"
    FOR UPDATE
    USING (
        -- Club owners can update
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
        )
        OR
        -- Organizers can update
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
            AND om.is_active = true
        )
    );

CREATE POLICY "zone_positions_club_and_org_delete" ON "public"."zone_positions"
    FOR DELETE
    USING (
        -- Club owners can delete
        auth.uid() IN (
            SELECT c.user_id 
            FROM clubes c
            JOIN tournaments t ON c.id = t.club_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
        )
        OR
        -- Organizers can delete
        auth.uid() IN (
            SELECT om.user_id 
            FROM organization_members om
            JOIN tournaments t ON t.organization_id = om.organizacion_id
            JOIN zones z ON z.tournament_id = t.id
            WHERE z.id = zone_positions.zone_id
            AND om.is_active = true
        )
    );

-- Add comments for documentation
COMMENT ON POLICY "zone_couples_club_and_org_manage" ON "public"."zone_couples" IS 'Allows club owners and active organization members to insert zone couples';
COMMENT ON POLICY "zones_club_and_org_manage" ON "public"."zones" IS 'Allows club owners and active organization members to insert zones';
COMMENT ON POLICY "zone_positions_club_and_org_manage" ON "public"."zone_positions" IS 'Allows club owners and active organization members to insert zone positions';
