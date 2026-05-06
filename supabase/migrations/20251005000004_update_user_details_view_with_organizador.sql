-- Update user_details_v to include organizador information
CREATE OR REPLACE VIEW "public"."user_details_v" AS
SELECT
  u.id,
  u.email,
  u.role,
  u.avatar_url,
  u.created_at,
  -- Keep original column order
  p.id AS player_id,
  c.id AS club_id,
  co.id AS coach_id,
  p.status AS player_status,
  -- Add new columns at the end
  om.organizacion_id AS organizador_id,
  p.first_name,
  p.last_name,
  COALESCE(org.name, c.name) AS name,
  org.logo_url
FROM users u
LEFT JOIN players p ON p.user_id = u.id
LEFT JOIN clubes c ON c.user_id = u.id
LEFT JOIN coaches co ON co.user_id = u.id
LEFT JOIN organization_members om ON om.user_id = u.id AND om.is_active = true AND om.member_role IN ('owner', 'admin')
LEFT JOIN organizaciones org ON org.id = om.organizacion_id;

-- Grant permissions
GRANT ALL ON TABLE "public"."user_details_v" TO "anon";
GRANT ALL ON TABLE "public"."user_details_v" TO "authenticated";
GRANT ALL ON TABLE "public"."user_details_v" TO "service_role";
