-- Migration: Add UNIQUE constraint to tournament_couple_seeds
-- Prevents duplicate couples in the same tournament seeding
-- This is the database-level protection against duplicate seeds

-- Step 1: Identify duplicates and the IDs to keep vs delete
-- We keep the one with lowest seed (better position)
CREATE TEMP TABLE seeds_to_delete AS
WITH duplicates AS (
  SELECT id, tournament_id, couple_id,
    ROW_NUMBER() OVER (
      PARTITION BY tournament_id, couple_id 
      ORDER BY seed ASC
    ) as rn
  FROM tournament_couple_seeds
)
SELECT id, tournament_id, couple_id FROM duplicates WHERE rn > 1;

CREATE TEMP TABLE seeds_to_keep AS
WITH duplicates AS (
  SELECT id, tournament_id, couple_id,
    ROW_NUMBER() OVER (
      PARTITION BY tournament_id, couple_id 
      ORDER BY seed ASC
    ) as rn
  FROM tournament_couple_seeds
)
SELECT id, tournament_id, couple_id FROM duplicates WHERE rn = 1;

-- Step 2: Update matches that reference duplicate seeds to point to the kept seed
-- For tournament_couple_seed1_id
UPDATE matches m
SET tournament_couple_seed1_id = k.id
FROM seeds_to_delete d
JOIN seeds_to_keep k ON d.tournament_id = k.tournament_id AND d.couple_id = k.couple_id
WHERE m.tournament_couple_seed1_id = d.id;

-- For tournament_couple_seed2_id
UPDATE matches m
SET tournament_couple_seed2_id = k.id
FROM seeds_to_delete d
JOIN seeds_to_keep k ON d.tournament_id = k.tournament_id AND d.couple_id = k.couple_id
WHERE m.tournament_couple_seed2_id = d.id;

-- Step 2b: Update placeholder_resolutions that reference duplicate seeds
UPDATE placeholder_resolutions pr
SET seed_id = k.id
FROM seeds_to_delete d
JOIN seeds_to_keep k ON d.tournament_id = k.tournament_id AND d.couple_id = k.couple_id
WHERE pr.seed_id = d.id;

-- Step 2c: Delete any placeholder_resolutions that still reference duplicates (orphaned records)
DELETE FROM placeholder_resolutions
WHERE seed_id IN (SELECT id FROM seeds_to_delete);

-- Step 2d: Handle seeds with couple_id = NULL (NULL = NULL is FALSE in SQL JOINs, so they were skipped above)
UPDATE matches m
SET tournament_couple_seed1_id = k.id
FROM seeds_to_delete d
JOIN seeds_to_keep k ON d.tournament_id = k.tournament_id AND d.couple_id IS NULL AND k.couple_id IS NULL
WHERE m.tournament_couple_seed1_id = d.id
AND d.couple_id IS NULL;

UPDATE matches m
SET tournament_couple_seed2_id = k.id
FROM seeds_to_delete d
JOIN seeds_to_keep k ON d.tournament_id = k.tournament_id AND d.couple_id IS NULL AND k.couple_id IS NULL
WHERE m.tournament_couple_seed2_id = d.id
AND d.couple_id IS NULL;

-- Catch-all: set to NULL any remaining references that couldn't be remapped
UPDATE matches SET tournament_couple_seed1_id = NULL
WHERE tournament_couple_seed1_id IN (SELECT id FROM seeds_to_delete);

UPDATE matches SET tournament_couple_seed2_id = NULL
WHERE tournament_couple_seed2_id IN (SELECT id FROM seeds_to_delete);

DELETE FROM placeholder_resolutions
WHERE seed_id IN (SELECT id FROM seeds_to_delete);

-- Step 3: Now safely delete the duplicates
DELETE FROM tournament_couple_seeds
WHERE id IN (SELECT id FROM seeds_to_delete);

-- Clean up temp tables
DROP TABLE seeds_to_delete;
DROP TABLE seeds_to_keep;

-- Step 4: Add unique constraint to prevent future duplicates
ALTER TABLE tournament_couple_seeds
ADD CONSTRAINT unique_tournament_couple_seed 
UNIQUE (tournament_id, couple_id);

-- Note: NOT adding unique constraint for bracket_position because 
-- regenerating brackets might temporarily have conflicts during the process
-- The code-level validation is sufficient for this

COMMENT ON CONSTRAINT unique_tournament_couple_seed ON tournament_couple_seeds IS 
'Prevents the same couple from appearing multiple times in a tournament seeding';

