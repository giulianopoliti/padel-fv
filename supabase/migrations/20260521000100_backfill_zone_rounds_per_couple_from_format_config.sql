WITH zone_counts AS (
  SELECT
    z.id AS zone_id,
    COALESCE(NULLIF(zp.count, 0), zc.count, 0) AS couple_count
  FROM public.zones z
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS count
    FROM public.zone_positions
    WHERE zone_id = z.id
  ) zp ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::integer AS count
    FROM public.zone_couples
    WHERE zone_id = z.id
  ) zc ON TRUE
),
resolved_rounds AS (
  SELECT
    z.id AS zone_id,
    CASE
      WHEN t.format_config->>'zoneStage' = 'ROUND_ROBIN'
        THEN GREATEST(zc.couple_count - 1, 0)
      WHEN t.format_config->>'baseType' = 'AMERICAN'
        AND t.format_config->>'zoneMode' = 'SINGLE_ZONE'
        AND t.format_config->>'bracketMode' = 'SINGLE'
        AND zc.couple_count = 3
        THEN 2
      WHEN t.format_config->>'baseType' = 'AMERICAN'
        AND t.format_config->>'zoneMode' = 'SINGLE_ZONE'
        AND t.format_config->>'bracketMode' = 'SINGLE'
        AND zc.couple_count = 5
        THEN 4
      WHEN t.format_config->>'baseType' = 'AMERICAN'
        AND t.format_config->>'zoneMode' = 'MULTI_ZONE'
        AND (t.format_config->>'targetMatchesPerCouple')::integer = 3
        AND zc.couple_count = 3
        THEN 2
      WHEN t.format_config ? 'targetMatchesPerCouple'
        AND t.format_config->>'targetMatchesPerCouple' IS NOT NULL
        AND t.format_config->>'targetMatchesPerCouple' <> ''
        THEN (t.format_config->>'targetMatchesPerCouple')::integer
      ELSE NULL
    END AS rounds_per_couple
  FROM public.zones z
  JOIN public.tournaments t ON t.id = z.tournament_id
  JOIN zone_counts zc ON zc.zone_id = z.id
  WHERE t.format_config->>'version' = '2'
)
UPDATE public.zones z
SET rounds_per_couple = rr.rounds_per_couple
FROM resolved_rounds rr
WHERE z.id = rr.zone_id
  AND rr.rounds_per_couple IS NOT NULL
  AND rr.rounds_per_couple > 0
  AND z.rounds_per_couple IS DISTINCT FROM rr.rounds_per_couple;
