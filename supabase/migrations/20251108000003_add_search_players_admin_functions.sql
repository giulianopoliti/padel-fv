-- Function to search players for admin panel
-- Searches by first_name, last_name, dni, and email (from joined users table)
CREATE OR REPLACE FUNCTION search_players_admin(
  search_pattern TEXT,
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  dni TEXT,
  phone TEXT,
  score INT,
  category_name TEXT,
  gender TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  users JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.dni,
    p.phone,
    p.score,
    p.category_name,
    p.gender,
    p.status,
    p.created_at,
    p.user_id,
    CASE
      WHEN u.id IS NOT NULL THEN jsonb_build_object('email', u.email)
      ELSE NULL
    END AS users
  FROM players p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE
    p.first_name ILIKE search_pattern OR
    p.last_name ILIKE search_pattern OR
    p.dni ILIKE search_pattern OR
    u.email ILIKE search_pattern
  ORDER BY p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count players matching search
CREATE OR REPLACE FUNCTION count_players_admin(
  search_pattern TEXT
)
RETURNS BIGINT AS $$
DECLARE
  total_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO total_count
  FROM players p
  LEFT JOIN users u ON p.user_id = u.id
  WHERE
    p.first_name ILIKE search_pattern OR
    p.last_name ILIKE search_pattern OR
    p.dni ILIKE search_pattern OR
    u.email ILIKE search_pattern;

  RETURN total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
