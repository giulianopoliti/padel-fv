

CREATE OR REPLACE FUNCTION "public"."advance_bye_winners_single_level"("p_tournament_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  advancement_count INTEGER := 0;
  result JSON;
BEGIN
  RAISE NOTICE 'Starting controlled BYE advancement (single-level) for tournament: %', p_tournament_id;
  
  -- Single-level advancement: Only advance immediate BYE winners to their direct parent matches
  WITH controlled_advancement AS (
    UPDATE matches parent_match
    SET 
      couple1_id = CASE 
        WHEN mh.parent_slot = 1 THEN bye_match.winner_id
        ELSE parent_match.couple1_id
      END,
      couple2_id = CASE 
        WHEN mh.parent_slot = 2 THEN bye_match.winner_id  
        ELSE parent_match.couple2_id
      END,
      status = CASE
        -- If parent match now has both couples, mark as PENDING
        WHEN (
          (CASE WHEN mh.parent_slot = 1 THEN bye_match.winner_id ELSE parent_match.couple1_id END) IS NOT NULL AND
          (CASE WHEN mh.parent_slot = 2 THEN bye_match.winner_id ELSE parent_match.couple2_id END) IS NOT NULL
        ) THEN 'PENDING'
        ELSE parent_match.status
      END
    FROM matches bye_match
    JOIN match_hierarchy mh ON mh.child_match_id = bye_match.id
    WHERE parent_match.id = mh.parent_match_id
      AND bye_match.tournament_id = p_tournament_id
      AND bye_match.status = 'FINISHED'
      AND bye_match.winner_id IS NOT NULL
      -- ✅ CONTROLLED: Only advance true BYE matches (one couple missing)
      AND (bye_match.couple1_id IS NULL OR bye_match.couple2_id IS NULL)
      -- ✅ CONTROLLED: Don't advance if parent already has this winner
      AND (
        (mh.parent_slot = 1 AND parent_match.couple1_id != bye_match.winner_id) OR
        (mh.parent_slot = 2 AND parent_match.couple2_id != bye_match.winner_id)
      )
      -- ✅ CONTROLLED: Only advance from matches updated in current session
      AND bye_match.updated_at >= NOW() - INTERVAL '5 minutes'
    RETURNING parent_match.id, bye_match.winner_id, mh.parent_slot
  )
  SELECT COUNT(*) INTO advancement_count FROM controlled_advancement;
  
  result := json_build_object(
    'success', true,
    'advancement_count', advancement_count,
    'tournament_id', p_tournament_id,
    'method', 'CONTROLLED_SINGLE_LEVEL_ADVANCEMENT',
    'timestamp', NOW()
  );
  
  RAISE NOTICE 'Controlled advancement result: %', result;
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed controlled BYE advancement: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;


ALTER FUNCTION "public"."advance_bye_winners_single_level"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_tournament_points"("player_updates" "jsonb"[], "match_points" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Actualizar puntos de jugadores
  FOR i IN 1..array_length(player_updates, 1) LOOP
    UPDATE players
    SET score = (player_updates[i]->>'new_score')::numeric
    WHERE id = (player_updates[i]->>'player_id')::uuid;
  END LOOP;

  -- Insertar puntos de partidos
  INSERT INTO match_points_couples (
    match_id,
    winner_couple_id,
    loser_couple_id,
    points_winner,
    points_loser
  )
  SELECT 
    (value->>'match_id')::uuid,
    (value->>'winner_couple_id')::uuid,
    (value->>'loser_couple_id')::uuid,
    (value->>'points_winner')::integer,
    (value->>'points_loser')::integer
  FROM jsonb_array_elements(match_points::jsonb);
END;
$$;


ALTER FUNCTION "public"."apply_tournament_points"("player_updates" "jsonb"[], "match_points" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_source_couple_id uuid;
  v_target_couple_id uuid;
  v_source_match matches%ROWTYPE;
  v_target_match matches%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_user_club_id uuid;
  
  -- ✅ NEW: Variables for hierarchy management
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

  -- ✅ NEW: Convert slot names to numbers for match_hierarchy
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
  -- STEP 3: PERMISSION VALIDATION
  -- ============================================================================
  
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  SELECT club_id INTO v_user_club_id FROM user_details_v WHERE id = p_user_id;
  
  IF v_user_club_id IS NULL OR v_user_club_id != v_tournament.club_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions - user must belong to tournament club',
      'operation_id', p_operation_id
    );
  END IF;

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
  -- STEP 5: ✅ NEW - GET CHILD MATCHES BEFORE UPDATES
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
  -- STEP 6: PERFORM COUPLE MOVEMENT IN MATCHES TABLE
  -- ============================================================================
  
  -- Move source couple to target slot
  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches 
    SET couple1_id = v_source_couple_id
    WHERE id = p_target_match_id;
  ELSE
    UPDATE matches 
    SET couple2_id = v_source_couple_id
    WHERE id = p_target_match_id;
  END IF;

  -- Clear the source slot
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches 
    SET couple1_id = NULL
    WHERE id = p_source_match_id;
  ELSE
    UPDATE matches 
    SET couple2_id = NULL
    WHERE id = p_source_match_id;
  END IF;

  -- ============================================================================
  -- STEP 7: ✅ NEW - UPDATE MATCH_HIERARCHY TO MAINTAIN COHERENCE
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
  -- STEP 7.5: ✅ FIXED - UPDATE MATCH STATUS WITH PROPER ENUM CASTING
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
  -- STEP 8: SUCCESS RESPONSE WITH ENHANCED DETAILS
  -- ============================================================================
  
  v_result := jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'details', jsonb_build_object(
      'moved_couple_id', v_source_couple_id,
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
        'step', 'couple_to_empty_swap_with_hierarchy'
      )
    );
    
END;
$$;


ALTER FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_source_couple_id uuid;
  v_target_couple_id uuid;
  v_source_match matches%ROWTYPE;
  v_target_match matches%ROWTYPE;
  v_tournament tournaments%ROWTYPE;
  v_user_club_id uuid;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Basic validation
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

  -- Get matches with lock
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

  -- Get tournament and validate permissions
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  
  SELECT club_id INTO v_user_club_id FROM user_details_v WHERE id = p_user_id;
  
  IF v_user_club_id IS NULL OR v_user_club_id != v_tournament.club_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions - user must belong to tournament club',
      'operation_id', p_operation_id
    );
  END IF;

  -- FIXED: Allow PENDING and WAITING_OPONENT status for COUPLE_TO_EMPTY swaps
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

  -- Source must have couple, Target must be EMPTY
  IF v_source_couple_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source slot is empty',
      'operation_id', p_operation_id
    );
  END IF;

  -- Target slot should be EMPTY for COUPLE_TO_EMPTY
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

  -- Perform the swap: move source couple to target, clear source
  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches 
    SET couple1_id = v_source_couple_id
    WHERE id = p_target_match_id;
  ELSE
    UPDATE matches 
    SET couple2_id = v_source_couple_id
    WHERE id = p_target_match_id;
  END IF;

  -- Clear the source slot
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches 
    SET couple1_id = NULL
    WHERE id = p_source_match_id;
  ELSE
    UPDATE matches 
    SET couple2_id = NULL
    WHERE id = p_source_match_id;
  END IF;

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'details', jsonb_build_object(
      'moved_couple_id', v_source_couple_id,
      'source_match_id', p_source_match_id,
      'target_match_id', p_target_match_id,
      'source_slot', p_source_slot,
      'target_slot', p_target_slot,
      'tournament_id', p_tournament_id,
      'timestamp', NOW()
    )
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database operation failed: ' || SQLERRM,
      'operation_id', p_operation_id,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."couple_to_placeholder_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_source_seed_id uuid;
  v_target_seed_id uuid;
  v_placeholder_label text;
  v_result jsonb;
BEGIN
  
  -- VALIDACIONES DE NEGOCIO
  
  -- 1. Source match debe ser PENDING
  IF NOT EXISTS(SELECT 1 FROM matches WHERE id = p_source_match_id AND status = 'PENDING') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source match must be PENDING status'
    );
  END IF;
  
  -- 2. Target match debe ser WAITING_OPONENT
  IF NOT EXISTS(SELECT 1 FROM matches WHERE id = p_target_match_id AND status = 'WAITING_OPONENT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target match must be WAITING_OPONENT status'
    );
  END IF;
  
  -- 3. Verificar que source tiene la pareja en el slot correcto
  IF p_source_slot = 'couple1_id' THEN
    IF NOT EXISTS(SELECT 1 FROM matches WHERE id = p_source_match_id AND couple1_id = p_source_couple_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Source couple not found in specified slot'
      );
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM matches WHERE id = p_source_match_id AND couple2_id = p_source_couple_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Source couple not found in specified slot'
      );
    END IF;
  END IF;
  
  -- 4. Verificar que target slot está vacío pero tiene placeholder
  IF p_target_slot = 'couple1_id' THEN
    SELECT 
      tournament_couple_seed1_id,
      placeholder_couple1_label
    INTO 
      v_target_seed_id,
      v_placeholder_label
    FROM matches 
    WHERE id = p_target_match_id 
      AND couple1_id IS NULL 
      AND tournament_couple_seed1_id IS NOT NULL
      AND placeholder_couple1_label IS NOT NULL;
  ELSE
    SELECT 
      tournament_couple_seed2_id,
      placeholder_couple2_label
    INTO 
      v_target_seed_id,
      v_placeholder_label
    FROM matches 
    WHERE id = p_target_match_id 
      AND couple2_id IS NULL 
      AND tournament_couple_seed2_id IS NOT NULL
      AND placeholder_couple2_label IS NOT NULL;
  END IF;
  
  IF v_target_seed_id IS NULL OR v_placeholder_label IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target slot must have placeholder and tournament_couple_seed_id'
    );
  END IF;
  
  -- 5. Obtener seed_id del source
  IF p_source_slot = 'couple1_id' THEN
    SELECT tournament_couple_seed1_id INTO v_source_seed_id
    FROM matches WHERE id = p_source_match_id;
  ELSE
    SELECT tournament_couple_seed2_id INTO v_source_seed_id
    FROM matches WHERE id = p_source_match_id;
  END IF;
  
  IF v_source_seed_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source match must have tournament_couple_seed_id'
    );
  END IF;
  
  -- OPERACIONES ATOMICAS
  BEGIN
    -- PASO 1: Mover pareja real al target (resolver placeholder)
    IF p_target_slot = 'couple1_id' THEN
      UPDATE matches 
      SET 
        couple1_id = p_source_couple_id,
        tournament_couple_seed1_id = v_source_seed_id,
        placeholder_couple1_label = NULL
      WHERE id = p_target_match_id;
    ELSE
      UPDATE matches 
      SET 
        couple2_id = p_source_couple_id,
        tournament_couple_seed2_id = v_source_seed_id,
        placeholder_couple2_label = NULL
      WHERE id = p_target_match_id;
    END IF;
    
    -- PASO 2: Colocar placeholder en source match
    IF p_source_slot = 'couple1_id' THEN
      UPDATE matches 
      SET 
        couple1_id = NULL,
        tournament_couple_seed1_id = v_target_seed_id,
        placeholder_couple1_label = v_placeholder_label
      WHERE id = p_source_match_id;
    ELSE
      UPDATE matches 
      SET 
        couple2_id = NULL,
        tournament_couple_seed2_id = v_target_seed_id,
        placeholder_couple2_label = v_placeholder_label
      WHERE id = p_source_match_id;
    END IF;
    
    -- PASO 3: Actualizar estados
    -- Target match: puede quedar PENDING o WAITING_OPONENT
    UPDATE matches 
    SET status = CASE 
      WHEN couple1_id IS NOT NULL AND couple2_id IS NOT NULL THEN 'PENDING'::match_status
      ELSE 'WAITING_OPONENT'::match_status
    END
    WHERE id = p_target_match_id;
    
    -- Source match: siempre queda WAITING_OPONENT (ahora tiene placeholder)
    UPDATE matches 
    SET status = 'WAITING_OPONENT'::match_status
    WHERE id = p_source_match_id;
    
    -- Resultado exitoso
    v_result := jsonb_build_object(
      'success', true,
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'moved_couple_id', p_source_couple_id,
        'moved_from_match_id', p_source_match_id,
        'moved_to_match_id', p_target_match_id,
        'swapped_seed_ids', jsonb_build_object(
          'source_seed_moved_to_target', v_source_seed_id,
          'target_seed_moved_to_source', v_target_seed_id
        ),
        'placeholder_label', v_placeholder_label,
        'placeholder_moved_to_source', true
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'operation_id', p_operation_id,
      'error', 'Database transaction failed: ' || SQLERRM
    );
END;

  RETURN v_result;

END;
$$;


ALTER FUNCTION "public"."couple_to_placeholder_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_placeholder_status"("p_tournament_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  total_placeholders INTEGER;
  resolved_placeholders INTEGER;
  result JSON;
BEGIN
  -- Count total placeholders created for this tournament
  SELECT COUNT(*) INTO total_placeholders
  FROM tournament_couple_seeds
  WHERE tournament_id = p_tournament_id
    AND created_as_placeholder = TRUE;
  
  -- Count resolved placeholders
  SELECT COUNT(*) INTO resolved_placeholders
  FROM tournament_couple_seeds
  WHERE tournament_id = p_tournament_id
    AND created_as_placeholder = TRUE
    AND is_placeholder = FALSE
    AND resolved_at IS NOT NULL;
  
  result := json_build_object(
    'tournament_id', p_tournament_id,
    'total_placeholders', total_placeholders,
    'resolved_placeholders', resolved_placeholders,
    'pending_placeholders', total_placeholders - resolved_placeholders,
    'resolution_percentage', 
      CASE 
        WHEN total_placeholders > 0 THEN (resolved_placeholders::float / total_placeholders::float * 100)::int
        ELSE 100 
      END
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_tournament_placeholder_status"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches 
    WHERE tournament_id = p_tournament_id
      AND round = 'ZONE'
      AND (couple1_id = p_couple_id OR couple2_id = p_couple_id)
      AND status != 'PENDING'
  );
END;
$$;


ALTER FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") IS 'Helper function to check if a couple has played any non-pending matches in zone phase for restrictions';


CREATE OR REPLACE FUNCTION "public"."resolve_placeholders_seeds_only"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  resolution JSONB;
  seed_ids UUID[];
  resolved_count INTEGER := 0;
  total_affected_matches INTEGER := 0;
  affected_matches INTEGER;
  current_seed_count INTEGER;
  result JSON;
BEGIN
  RAISE NOTICE 'Starting SEEDS-ONLY placeholder resolution for tournament: %', p_tournament_id;
  
  FOR resolution IN SELECT value FROM jsonb_array_elements(p_zone_resolutions)
  LOOP
    RAISE NOTICE 'Processing: zone_id=%, position=%, couple_id=%', 
      resolution->>'zone_id', resolution->>'position', resolution->>'couple_id';
    
    -- 1. Encontrar seeds para resolver
    SELECT ARRAY(
      SELECT id FROM tournament_couple_seeds 
      WHERE tournament_id = p_tournament_id
        AND is_placeholder = TRUE
        AND placeholder_zone_id = (resolution->>'zone_id')::UUID
        AND placeholder_position = (resolution->>'position')::INTEGER
    ) INTO seed_ids;
    
    current_seed_count := COALESCE(array_length(seed_ids, 1), 0);
    RAISE NOTICE 'Found % seeds: %', current_seed_count, seed_ids;
    
    IF current_seed_count > 0 THEN
      -- 2. Resolver seeds
      UPDATE tournament_couple_seeds 
      SET 
        couple_id = (resolution->>'couple_id')::UUID,
        is_placeholder = FALSE,
        placeholder_zone_id = NULL,
        placeholder_position = NULL,
        placeholder_label = NULL,
        resolved_at = NOW()
      WHERE id = ANY(seed_ids);
      
      -- 3. Propagar a matches (SIN cambiar status)
      WITH updated_matches AS (
        UPDATE matches 
        SET 
          couple1_id = CASE 
            WHEN tournament_couple_seed1_id = ANY(seed_ids) THEN (resolution->>'couple_id')::UUID
            ELSE couple1_id 
          END,
          couple2_id = CASE 
            WHEN tournament_couple_seed2_id = ANY(seed_ids) THEN (resolution->>'couple_id')::UUID
            ELSE couple2_id 
          END,
          placeholder_couple1_label = CASE 
            WHEN tournament_couple_seed1_id = ANY(seed_ids) THEN NULL
            ELSE placeholder_couple1_label 
          END,
          placeholder_couple2_label = CASE 
            WHEN tournament_couple_seed2_id = ANY(seed_ids) THEN NULL
            ELSE placeholder_couple2_label 
          END
        WHERE (tournament_couple_seed1_id = ANY(seed_ids) OR tournament_couple_seed2_id = ANY(seed_ids))
        RETURNING id
      )
      SELECT COUNT(*) INTO affected_matches FROM updated_matches;
      
      -- ✅ SEEDS-ONLY: NO tocamos el status de los matches
      RAISE NOTICE 'Seeds resolved and matches updated (status unchanged): %d matches affected', COALESCE(affected_matches, 0);
      
      resolved_count := resolved_count + current_seed_count;
      total_affected_matches := total_affected_matches + COALESCE(affected_matches, 0);
      
      RAISE NOTICE 'Batch completed: %d seeds resolved, %d matches updated', 
        current_seed_count, COALESCE(affected_matches, 0);
    END IF;
  END LOOP;
  
  result := json_build_object(
    'success', true,
    'resolved_count', resolved_count,
    'affected_matches', total_affected_matches,
    'bye_matches_created', 0, -- ✅ SEEDS-ONLY: No BYE processing
    'matches_advanced', 0,
    'tournament_id', p_tournament_id,
    'method', 'SEEDS_ONLY_NO_STATUS_CHANGES',
    'timestamp', NOW()
  );
  
  RAISE NOTICE 'SEEDS-ONLY Final result: %', result;
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to resolve placeholders (SEEDS-ONLY): % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;


ALTER FUNCTION "public"."resolve_placeholders_seeds_only"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_placeholders_with_fks"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  resolution JSONB;
  seed_ids UUID[];
  resolved_count INTEGER := 0;
  total_affected_matches INTEGER := 0;
  total_bye_matches_created INTEGER := 0;
  affected_matches INTEGER;
  bye_matches_created INTEGER;
  matches_advanced INTEGER := 0;
  current_seed_count INTEGER; -- ✅ FIX: Separate variable for safe counting
  result JSON;
BEGIN
  RAISE NOTICE 'Starting FIXED placeholder resolution for tournament: %', p_tournament_id;
  
  FOR resolution IN SELECT value FROM jsonb_array_elements(p_zone_resolutions)
  LOOP
    RAISE NOTICE 'Processing: zone_id=%, position=%, couple_id=%', 
      resolution->>'zone_id', resolution->>'position', resolution->>'couple_id';
    
    -- 1. Encontrar seeds para resolver
    SELECT ARRAY(
      SELECT id FROM tournament_couple_seeds 
      WHERE tournament_id = p_tournament_id
        AND is_placeholder = TRUE
        AND placeholder_zone_id = (resolution->>'zone_id')::UUID
        AND placeholder_position = (resolution->>'position')::INTEGER
    ) INTO seed_ids;
    
    -- ✅ FIX: Safe counting logic
    current_seed_count := COALESCE(array_length(seed_ids, 1), 0);
    RAISE NOTICE 'Found % seeds: %', current_seed_count, seed_ids;
    
    IF current_seed_count > 0 THEN
      -- 2. Resolver seeds
      UPDATE tournament_couple_seeds 
      SET 
        couple_id = (resolution->>'couple_id')::UUID,
        is_placeholder = FALSE,
        placeholder_zone_id = NULL,
        placeholder_position = NULL,
        placeholder_label = NULL,
        resolved_at = NOW()
      WHERE id = ANY(seed_ids);
      
      -- 3. Propagar a matches
      WITH updated_matches AS (
        UPDATE matches 
        SET 
          couple1_id = CASE 
            WHEN tournament_couple_seed1_id = ANY(seed_ids) THEN (resolution->>'couple_id')::UUID
            ELSE couple1_id 
          END,
          couple2_id = CASE 
            WHEN tournament_couple_seed2_id = ANY(seed_ids) THEN (resolution->>'couple_id')::UUID
            ELSE couple2_id 
          END,
          placeholder_couple1_label = CASE 
            WHEN tournament_couple_seed1_id = ANY(seed_ids) THEN NULL
            ELSE placeholder_couple1_label 
          END,
          placeholder_couple2_label = CASE 
            WHEN tournament_couple_seed2_id = ANY(seed_ids) THEN NULL
            ELSE placeholder_couple2_label 
          END
        WHERE (tournament_couple_seed1_id = ANY(seed_ids) OR tournament_couple_seed2_id = ANY(seed_ids))
        RETURNING id
      )
      SELECT COUNT(*) INTO affected_matches FROM updated_matches;
      
      -- 4. CONTROLLED BYE RESOLUTION: Only mark as BYE, don't auto-advance
      WITH bye_resolution AS (
        UPDATE matches 
        SET 
          status = 'FINISHED',
          winner_id = COALESCE(couple1_id, couple2_id)
        WHERE tournament_id = p_tournament_id
          AND type = 'ELIMINATION'  
          AND status IN ('WAITING_OPONENT', 'PENDING', 'BYE')
          AND (
            (couple1_id IS NOT NULL AND couple2_id IS NULL AND tournament_couple_seed2_id IS NULL) OR
            (couple1_id IS NULL AND couple2_id IS NOT NULL AND tournament_couple_seed1_id IS NULL)
          )
          AND (tournament_couple_seed1_id = ANY(seed_ids) OR tournament_couple_seed2_id = ANY(seed_ids))
        RETURNING id, winner_id, couple1_id, couple2_id
      )
      SELECT COUNT(*) INTO bye_matches_created FROM bye_resolution;
      
      RAISE NOTICE 'CONTROLLED BYE resolution: marked % matches as BYE (no auto-advancement)', bye_matches_created;
      
      -- ✅ FIX: Safe accumulation
      resolved_count := resolved_count + current_seed_count;
      total_affected_matches := total_affected_matches + COALESCE(affected_matches, 0);
      total_bye_matches_created := total_bye_matches_created + COALESCE(bye_matches_created, 0);
      
      RAISE NOTICE 'Batch completed: %d seeds, %d matches, %d BYEs', 
        current_seed_count, COALESCE(affected_matches, 0), COALESCE(bye_matches_created, 0);
    END IF;
  END LOOP;
  
  -- Return result summary
  result := json_build_object(
    'success', true,
    'resolved_count', resolved_count,
    'affected_matches', total_affected_matches,
    'bye_matches_created', total_bye_matches_created,
    'matches_advanced', 0, -- ✅ CONTROLLED: No auto-advancement in RPC
    'tournament_id', p_tournament_id,
    'method', 'FK_FIXED_COUNTING_CONTROLLED_BYES',
    'timestamp', NOW()
  );
  
  RAISE NOTICE 'FIXED Final result: %', result;
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to resolve placeholders (FIXED): % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;


ALTER FUNCTION "public"."resolve_placeholders_with_fks"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_matches_via_fk"("p_tournament_id" "uuid", "p_seed_id" "uuid", "p_couple_id" "uuid") RETURNS TABLE("match_id" "uuid", "couple1_id" "uuid", "couple2_id" "uuid", "status" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE NOTICE 'Updating matches for seed % with couple %', p_seed_id, p_couple_id;

  -- Actualizar matches usando CASE statements en SQL nativo + lógica de status
  UPDATE matches 
  SET 
    couple1_id = CASE 
      WHEN tournament_couple_seed1_id = p_seed_id THEN p_couple_id 
      ELSE matches.couple1_id 
    END,
    couple2_id = CASE 
      WHEN tournament_couple_seed2_id = p_seed_id THEN p_couple_id 
      ELSE matches.couple2_id 
    END,
    placeholder_couple1_label = CASE 
      WHEN tournament_couple_seed1_id = p_seed_id THEN NULL 
      ELSE matches.placeholder_couple1_label 
    END,
    placeholder_couple2_label = CASE 
      WHEN tournament_couple_seed2_id = p_seed_id THEN NULL 
      ELSE matches.placeholder_couple2_label 
    END,
    -- ✅ NUEVA LÓGICA: Cambiar status a PENDING cuando ambas parejas están asignadas
    status = CASE 
      WHEN (
        (CASE WHEN tournament_couple_seed1_id = p_seed_id THEN p_couple_id ELSE matches.couple1_id END) IS NOT NULL 
        AND 
        (CASE WHEN tournament_couple_seed2_id = p_seed_id THEN p_couple_id ELSE matches.couple2_id END) IS NOT NULL
      ) THEN 'PENDING'
      ELSE matches.status 
    END
  WHERE 
    matches.tournament_id = p_tournament_id
    AND (
      tournament_couple_seed1_id = p_seed_id 
      OR tournament_couple_seed2_id = p_seed_id
    );

  -- Retornar matches actualizados (incluyendo status)
  RETURN QUERY
  SELECT 
    matches.id,
    matches.couple1_id,
    matches.couple2_id,
    matches.status::TEXT
  FROM matches
  WHERE 
    matches.tournament_id = p_tournament_id
    AND (
      tournament_couple_seed1_id = p_seed_id 
      OR tournament_couple_seed2_id = p_seed_id
    );

  RAISE NOTICE 'Updated matches for seed %: % rows', p_seed_id, FOUND;
END;
$$;


ALTER FUNCTION "public"."update_matches_via_fk"("p_tournament_id" "uuid", "p_seed_id" "uuid", "p_couple_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couple_fecha_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_id" "uuid" NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "matches_played" integer DEFAULT 0 NOT NULL,
    "matches_won" integer DEFAULT 0 NOT NULL,
    "matches_lost" integer DEFAULT 0 NOT NULL,
    "sets_won" integer DEFAULT 0 NOT NULL,
    "sets_lost" integer DEFAULT 0 NOT NULL,
    "games_won" integer DEFAULT 0 NOT NULL,
    "games_lost" integer DEFAULT 0 NOT NULL,
    "games_difference" integer DEFAULT 0 NOT NULL,
    "points_earned" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "games_difference_consistency" CHECK (("games_difference" = ("games_won" - "games_lost"))),
    CONSTRAINT "matches_consistency" CHECK ((("matches_won" + "matches_lost") <= "matches_played")),
    CONSTRAINT "non_negative_games" CHECK ((("games_won" >= 0) AND ("games_lost" >= 0))),
    CONSTRAINT "non_negative_matches" CHECK ((("matches_played" >= 0) AND ("matches_won" >= 0) AND ("matches_lost" >= 0))),
    CONSTRAINT "non_negative_sets" CHECK ((("sets_won" >= 0) AND ("sets_lost" >= 0)))
);


ALTER TABLE "public"."couple_fecha_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."couple_fecha_stats" IS 'Estadísticas detalladas por pareja y fecha para rankings y reportes';



CREATE TABLE IF NOT EXISTS "public"."couple_time_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "time_slot_id" "uuid" NOT NULL,
    "is_available" boolean DEFAULT false NOT NULL,
    "preferred_start_time" time without time zone,
    "preferred_end_time" time without time zone,
    "can_start_earlier" boolean DEFAULT false NOT NULL,
    "can_finish_later" boolean DEFAULT false NOT NULL,
    "minimum_duration_minutes" integer DEFAULT 90,
    "notes" "text",
    "priority_level" integer DEFAULT 3 NOT NULL,
    "flexibility_level" "public"."flexibility_level" DEFAULT 'MEDIUM'::"public"."flexibility_level" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_duration" CHECK ((("minimum_duration_minutes" IS NULL) OR ("minimum_duration_minutes" > 0))),
    CONSTRAINT "valid_preferred_times" CHECK ((("preferred_start_time" IS NULL) OR ("preferred_end_time" IS NULL) OR ("preferred_start_time" < "preferred_end_time"))),
    CONSTRAINT "valid_priority_level" CHECK ((("priority_level" >= 1) AND ("priority_level" <= 5)))
);


ALTER TABLE "public"."couple_time_availability" OWNER TO "postgres";


COMMENT ON TABLE "public"."couple_time_availability" IS 'Sistema flexible de disponibilidad - parejas marcan preferencias dentro de slots';



COMMENT ON COLUMN "public"."couple_time_availability"."preferred_start_time" IS 'Hora preferida de inicio dentro del slot disponible';



COMMENT ON COLUMN "public"."couple_time_availability"."preferred_end_time" IS 'Hora preferida de finalización dentro del slot';



COMMENT ON COLUMN "public"."couple_time_availability"."priority_level" IS 'Prioridad de este horario para la pareja (1-5)';



COMMENT ON COLUMN "public"."couple_time_availability"."flexibility_level" IS 'Nivel de flexibilidad horaria de la pareja';



CREATE TABLE IF NOT EXISTS "public"."organizaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "phone" "text",
    "email" "text",
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organizaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organizacion_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL
);


ALTER TABLE "public"."organization_clubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organizacion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "member_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";



CREATE TABLE IF NOT EXISTS "public"."tournament_fechas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "fecha_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date",
    "end_date" "date",
    "status" "public"."fecha_status" DEFAULT 'NOT_STARTED'::"public"."fecha_status" NOT NULL,
    "is_qualifying" boolean DEFAULT false NOT NULL,
    "max_matches_per_couple" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_fecha_number" CHECK (("fecha_number" > 0)),
    CONSTRAINT "positive_max_matches" CHECK ((("max_matches_per_couple" IS NULL) OR ("max_matches_per_couple" > 0))),
    CONSTRAINT "valid_date_range" CHECK ((("end_date" IS NULL) OR ("start_date" <= "end_date")))
);


ALTER TABLE "public"."tournament_fechas" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournament_fechas" IS 'Fechas conceptuales del torneo (Fecha 1, Cuartos, etc.) - Sistema escalable para torneos largos';



COMMENT ON COLUMN "public"."tournament_fechas"."fecha_number" IS 'Número secuencial de la fecha (1, 2, 3...)';



COMMENT ON COLUMN "public"."tournament_fechas"."is_qualifying" IS 'True para fases clasificatorias, false para eliminación directa';



COMMENT ON COLUMN "public"."tournament_fechas"."max_matches_per_couple" IS 'Límite de partidos por pareja en esta fecha específica';



CREATE TABLE IF NOT EXISTS "public"."tournament_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "court_name" "text",
    "max_matches" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_max_matches" CHECK (("max_matches" > 0)),
    CONSTRAINT "valid_time_range" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."tournament_time_slots" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournament_time_slots" IS 'Franjas horarias específicas creadas por organizadores para cada fecha';



COMMENT ON COLUMN "public"."tournament_time_slots"."max_matches" IS 'Número máximo de partidos simultáneos en este horario/cancha';



ALTER TABLE ONLY "public"."couple_fecha_stats"
    ADD CONSTRAINT "couple_fecha_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "couple_time_availability_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organizaciones"
    ADD CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_clubs"
    ADD CONSTRAINT "organization_clubs_organizacion_id_club_id_key" UNIQUE ("organizacion_id", "club_id");



ALTER TABLE ONLY "public"."organization_clubs"
    ADD CONSTRAINT "organization_clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organizacion_id_user_id_key" UNIQUE ("organizacion_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."tournament_time_slots"
    ADD CONSTRAINT "tournament_time_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_fecha_stats"
    ADD CONSTRAINT "unique_couple_fecha_stats" UNIQUE ("fecha_id", "couple_id");



ALTER TABLE ONLY "public"."couple_time_availability"
    ADD CONSTRAINT "unique_couple_time_slot" UNIQUE ("couple_id", "time_slot_id");



ALTER TABLE ONLY "public"."tournament_fechas"
    ADD CONSTRAINT "unique_fecha_per_tournament" UNIQUE ("tournament_id", "fecha_number");



ALTER TABLE ONLY "public"."fecha_matches"
    ADD CONSTRAINT "unique_match_in_fecha" UNIQUE ("match_id");


ALTER TABLE ONLY "public"."tournament_fechas"
    ADD CONSTRAINT "tournament_fechas_pkey" PRIMARY KEY ("id");



