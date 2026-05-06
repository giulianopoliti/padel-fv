-- ============================================================================
-- Migration: Fix couple_to_empty_swap to update tournament_couple_seed_id
-- ============================================================================
--
-- PROBLEMA:
-- - couple_to_empty_swap mueve couple_id pero NO mueve tournament_couple_seed_id
-- - Esto rompe la validación de structural BYE porque seed no coincide con couple
-- - Cuando mueves una pareja a un espacio vacío, el seed se queda en la posición vieja
--
-- SOLUCIÓN:
-- Actualizar couple_to_empty_swap para mover AMBOS:
-- - couple_id Y tournament_couple_seed_id juntos (como hace swap_bracket_positions_atomic)
--
-- CASOS DE USO:
-- 1. Mover pareja de 4TOS #1 couple1 → 4TOS #2 couple1 (vacío)
--    - Debe mover couple1_id Y tournament_couple_seed1_id
-- 2. Structural BYE validation requiere que couple_id y seed_id estén sincronizados
--
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."couple_to_empty_swap"(
  "p_tournament_id" "uuid",
  "p_user_id" "uuid",
  "p_source_match_id" "uuid",
  "p_target_match_id" "uuid",
  "p_source_slot" "text",
  "p_target_slot" "text",
  "p_operation_id" "text"
) RETURNS "jsonb"
LANGUAGE "plpgsql"
AS $$
DECLARE
  v_source_couple_id uuid;
  v_target_couple_id uuid;
  v_source_match matches%ROWTYPE;
  v_target_match matches%ROWTYPE;

  -- ✅ NEW: Variables for seed IDs
  v_source_seed_id uuid;
  v_target_seed_id uuid;

  -- Variables for hierarchy management
  v_source_slot_num smallint;
  v_target_slot_num smallint;
  v_source_child_matches uuid[];
  v_target_child_matches uuid[];
  v_hierarchy_updates_count integer := 0;
  v_temp_count integer;

  v_result jsonb := '{}'::jsonb;

BEGIN
  -- ============================================================================
  -- STEP 1: BASIC VALIDATION
  -- ============================================================================

  IF p_tournament_id IS NULL OR p_user_id IS NULL OR
     p_source_match_id IS NULL OR p_target_match_id IS NULL OR
     p_source_slot IS NULL OR p_target_slot IS NULL OR
     p_operation_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters',
      'operation_id', p_operation_id
    );
  END IF;

  -- Validate slot format
  IF p_source_slot NOT IN ('couple1_id', 'couple2_id') OR
     p_target_slot NOT IN ('couple1_id', 'couple2_id') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid slot format - must be couple1_id or couple2_id',
      'operation_id', p_operation_id
    );
  END IF;

  -- Convert slot names to numbers for match_hierarchy
  v_source_slot_num := CASE WHEN p_source_slot = 'couple1_id' THEN 1 ELSE 2 END;
  v_target_slot_num := CASE WHEN p_target_slot = 'couple1_id' THEN 1 ELSE 2 END;

  -- ============================================================================
  -- STEP 2: GET MATCHES WITH LOCKS
  -- ============================================================================

  SELECT * INTO v_source_match
  FROM matches
  WHERE id = p_source_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source match not found or not in tournament',
      'operation_id', p_operation_id
    );
  END IF;

  SELECT * INTO v_target_match
  FROM matches
  WHERE id = p_target_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target match not found or not in tournament',
      'operation_id', p_operation_id
    );
  END IF;

  -- ============================================================================
  -- STEP 3: PERMISSION VALIDATION REMOVED
  -- ============================================================================
  --
  -- REMOVED: Permission check - Backend API handles this via checkTournamentPermissions()
  -- Backend validates CLUB owners, ORGANIZADOR members, and ADMIN users
  -- Consistent with swap_bracket_positions_atomic and couple_to_placeholder_swap
  --
  -- ============================================================================

  -- ============================================================================
  -- STEP 4: BUSINESS LOGIC VALIDATION
  -- ============================================================================

  -- Allow PENDING and WAITING_OPPONENT status for moves to empty slots
  IF v_source_match.status NOT IN ('PENDING', 'WAITING_OPONENT') OR
     v_target_match.status NOT IN ('PENDING', 'WAITING_OPONENT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source and target matches must be PENDING or WAITING_OPONENT status',
      'operation_id', p_operation_id
    );
  END IF;

  -- Extract couple IDs from slots
  IF p_source_slot = 'couple1_id' THEN
    v_source_couple_id := v_source_match.couple1_id;
  ELSE
    v_source_couple_id := v_source_match.couple2_id;
  END IF;

  IF p_target_slot = 'couple1_id' THEN
    v_target_couple_id := v_target_match.couple1_id;
  ELSE
    v_target_couple_id := v_target_match.couple2_id;
  END IF;

  -- ✅ NEW: Extract seed IDs from slots
  IF p_source_slot = 'couple1_id' THEN
    v_source_seed_id := v_source_match.tournament_couple_seed1_id;
  ELSE
    v_source_seed_id := v_source_match.tournament_couple_seed2_id;
  END IF;

  IF p_target_slot = 'couple1_id' THEN
    v_target_seed_id := v_target_match.tournament_couple_seed1_id;
  ELSE
    v_target_seed_id := v_target_match.tournament_couple_seed2_id;
  END IF;

  -- Source must have couple, Target must be EMPTY
  IF v_source_couple_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source slot is empty - nothing to move',
      'operation_id', p_operation_id
    );
  END IF;

  -- Target slot should be EMPTY for COUPLE_TO_EMPTY operation
  IF v_target_couple_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target slot must be empty for COUPLE_TO_EMPTY swap',
      'operation_id', p_operation_id
    );
  END IF;

  -- Validate not same position
  IF p_source_match_id = p_target_match_id AND p_source_slot = p_target_slot THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot move couple to the same position',
      'operation_id', p_operation_id
    );
  END IF;

  -- ============================================================================
  -- STEP 5: GET CHILD MATCHES BEFORE UPDATES
  -- ============================================================================

  -- Get child matches that currently point to source slot (these follow the moved couple)
  SELECT array_agg(child_match_id) INTO v_source_child_matches
  FROM match_hierarchy
  WHERE parent_match_id = p_source_match_id
    AND parent_slot = v_source_slot_num
    AND tournament_id = p_tournament_id;

  -- Get child matches that currently point to target slot (these move to vacant source slot)
  SELECT array_agg(child_match_id) INTO v_target_child_matches
  FROM match_hierarchy
  WHERE parent_match_id = p_target_match_id
    AND parent_slot = v_target_slot_num
    AND tournament_id = p_tournament_id;

  -- ============================================================================
  -- STEP 6: ✅ FIXED - PERFORM COUPLE AND SEED MOVEMENT IN MATCHES TABLE
  -- ============================================================================

  -- Move source couple AND seed to target slot
  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches
    SET couple1_id = v_source_couple_id,
        tournament_couple_seed1_id = v_source_seed_id
    WHERE id = p_target_match_id;
  ELSE
    UPDATE matches
    SET couple2_id = v_source_couple_id,
        tournament_couple_seed2_id = v_source_seed_id
    WHERE id = p_target_match_id;
  END IF;

  -- Clear the source slot AND seed
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches
    SET couple1_id = NULL,
        tournament_couple_seed1_id = NULL
    WHERE id = p_source_match_id;
  ELSE
    UPDATE matches
    SET couple2_id = NULL,
        tournament_couple_seed2_id = NULL
    WHERE id = p_source_match_id;
  END IF;

  -- ============================================================================
  -- STEP 7: UPDATE MATCH_HIERARCHY TO MAINTAIN COHERENCE
  -- ============================================================================

  -- 7a. Move child matches that were pointing to source slot -> they now point to target slot
  -- (These child matches "follow" the moved couple to its new location)
  IF v_source_child_matches IS NOT NULL THEN
    UPDATE match_hierarchy
    SET parent_match_id = p_target_match_id,
        parent_slot = v_target_slot_num
    WHERE parent_match_id = p_source_match_id
      AND parent_slot = v_source_slot_num
      AND tournament_id = p_tournament_id;

    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_hierarchy_updates_count := v_temp_count;
  END IF;

  -- 7b. Move child matches that were pointing to target slot -> they now point to vacant source slot
  -- (These child matches now fill the slot that became vacant)
  IF v_target_child_matches IS NOT NULL THEN
    UPDATE match_hierarchy
    SET parent_match_id = p_source_match_id,
        parent_slot = v_source_slot_num
    WHERE child_match_id = ANY(v_target_child_matches)
      AND parent_match_id = p_target_match_id
      AND parent_slot = v_target_slot_num
      AND tournament_id = p_tournament_id;

    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_hierarchy_updates_count := v_hierarchy_updates_count + v_temp_count;
  END IF;

  -- ============================================================================
  -- STEP 8: UPDATE MATCH STATUS WITH PROPER ENUM CASTING
  -- ============================================================================

  -- Update target match status: if it now has 2 couples, set to PENDING
  UPDATE matches
  SET status = CASE
    WHEN couple1_id IS NOT NULL AND couple2_id IS NOT NULL THEN 'PENDING'::match_status
    ELSE 'WAITING_OPONENT'::match_status
  END
  WHERE id = p_target_match_id;

  -- Update source match status: if it now has less than 2 couples, set to WAITING_OPONENT
  UPDATE matches
  SET status = CASE
    WHEN couple1_id IS NOT NULL AND couple2_id IS NOT NULL THEN 'PENDING'::match_status
    ELSE 'WAITING_OPONENT'::match_status
  END
  WHERE id = p_source_match_id;

  -- ============================================================================
  -- STEP 9: SUCCESS RESPONSE WITH ENHANCED DETAILS
  -- ============================================================================

  v_result := jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'details', jsonb_build_object(
      'moved_couple_id', v_source_couple_id,
      'moved_seed_id', v_source_seed_id,
      'source_match_id', p_source_match_id,
      'target_match_id', p_target_match_id,
      'source_slot', p_source_slot,
      'target_slot', p_target_slot,
      'hierarchy_updates', jsonb_build_object(
        'total_updates', v_hierarchy_updates_count,
        'source_children_moved', COALESCE(v_source_child_matches, ARRAY[]::uuid[]),
        'target_children_moved', COALESCE(v_target_child_matches, ARRAY[]::uuid[]),
        'source_children_count', COALESCE(array_length(v_source_child_matches, 1), 0),
        'target_children_count', COALESCE(array_length(v_target_child_matches, 1), 0)
      ),
      'tournament_id', p_tournament_id,
      'timestamp', NOW()
    )
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Enhanced error reporting
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database operation failed: ' || SQLERRM,
      'operation_id', p_operation_id,
      'error_code', SQLSTATE,
      'error_context', jsonb_build_object(
        'source_match_id', p_source_match_id,
        'target_match_id', p_target_match_id,
        'source_slot', p_source_slot,
        'target_slot', p_target_slot,
        'step', 'couple_to_empty_swap_with_seed_sync'
      )
    );

END;
$$;

ALTER FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") IS 'Updated to move both couple_id AND tournament_couple_seed_id together. Required for structural BYE validation to work correctly when moving couples to empty slots.';
