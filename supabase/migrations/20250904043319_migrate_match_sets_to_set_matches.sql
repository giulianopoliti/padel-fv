-- Migrate data from match_sets to set_matches
INSERT INTO "public"."set_matches" (
    id, 
    match_id, 
    set_number, 
    couple1_games, 
    couple2_games, 
    created_at,
    updated_at,
    status
)
SELECT 
    id,
    match_id,
    set_number::smallint,
    couple1_games::smallint,
    couple2_games::smallint,
    created_at,
    updated_at,
    'COMPLETED'::text
FROM "public"."match_sets"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."set_matches" sm 
    WHERE sm.match_id = match_sets.match_id 
    AND sm.set_number = match_sets.set_number
);