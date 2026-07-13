-- Allow tournament managers to manually manage couple availability.
-- This supports organizer-entered availability from match-scheduling when
-- couples send availability outside the player self-service flow.

DROP POLICY IF EXISTS "Tournament managers can manage couple_time_availability"
ON "public"."couple_time_availability";

CREATE POLICY "Tournament managers can manage couple_time_availability"
ON "public"."couple_time_availability"
FOR ALL
TO "authenticated"
USING (
  EXISTS (
    SELECT 1
    FROM "public"."tournament_time_slots" ts
    JOIN "public"."tournament_fechas" tf ON tf.id = ts.fecha_id
    JOIN "public"."tournaments" t ON t.id = tf.tournament_id
    LEFT JOIN "public"."clubes" c ON c.id = t.club_id
    LEFT JOIN "public"."organization_members" om
      ON om.organizacion_id = t.organization_id
      AND om.user_id = (SELECT auth.uid())
      AND om.is_active = true
    LEFT JOIN "public"."users" u
      ON u.id = (SELECT auth.uid())
    WHERE ts.id = couple_time_availability.time_slot_id
      AND (
        c.user_id = (SELECT auth.uid())
        OR om.user_id = (SELECT auth.uid())
        OR u.role = 'ADMIN'::"public"."ROLE"
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."tournament_time_slots" ts
    JOIN "public"."tournament_fechas" tf ON tf.id = ts.fecha_id
    JOIN "public"."tournaments" t ON t.id = tf.tournament_id
    LEFT JOIN "public"."clubes" c ON c.id = t.club_id
    LEFT JOIN "public"."organization_members" om
      ON om.organizacion_id = t.organization_id
      AND om.user_id = (SELECT auth.uid())
      AND om.is_active = true
    LEFT JOIN "public"."users" u
      ON u.id = (SELECT auth.uid())
    WHERE ts.id = couple_time_availability.time_slot_id
      AND (
        c.user_id = (SELECT auth.uid())
        OR om.user_id = (SELECT auth.uid())
        OR u.role = 'ADMIN'::"public"."ROLE"
      )
  )
);

COMMENT ON POLICY "Tournament managers can manage couple_time_availability"
ON "public"."couple_time_availability"
IS 'Allows club owners, active organization members, and admins to insert/update/delete couple availability for tournament time slots.';
