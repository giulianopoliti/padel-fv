

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."GENDER" AS ENUM (
    'MALE',
    'SHEMALE',
    'MIXED',
    'FEMALE'
);


ALTER TYPE "public"."GENDER" OWNER TO "postgres";


COMMENT ON TYPE "public"."GENDER" IS 'MALE OR SHEMALE';



CREATE TYPE "public"."PREFERRED_SIDE" AS ENUM (
    'DRIVE',
    'REVES'
);


ALTER TYPE "public"."PREFERRED_SIDE" OWNER TO "postgres";


CREATE TYPE "public"."ROLE" AS ENUM (
    'PLAYER',
    'COACH',
    'CLUB',
    'ORGANIZADOR'
);


ALTER TYPE "public"."ROLE" OWNER TO "postgres";


COMMENT ON TYPE "public"."ROLE" IS 'Enumerated, player, coach, club';



CREATE TYPE "public"."ROUND" AS ENUM (
    'ZONE',
    '32VOS',
    '16VOS',
    '8VOS',
    '4TOS',
    'SEMIFINAL',
    'FINAL'
);


ALTER TYPE "public"."ROUND" OWNER TO "postgres";


CREATE TYPE "public"."bracket_status" AS ENUM (
    'NOT_STARTED',
    'REGISTRATION_LOCKED',
    'BRACKET_GENERATED',
    'BRACKET_ACTIVE'
);


ALTER TYPE "public"."bracket_status" OWNER TO "postgres";


CREATE TYPE "public"."match_status" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED',
    'FINISHED',
    'BYE',
    'WAITING_OPONENT'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE TYPE "public"."status_tournament" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'FINISHED',
    'PAIRING',
    'CANCELED',
    'FINISHED_POINTS_PENDING',
    'FINISHED_POINTS_CALCULATED',
    'ZONES_READY',
    'MATCHES_READY',
    'ZONE_PHASE',
    'ELIMINATION',
    'BRACKET_PHASE',
    'ZONE_REGISTRATION'
);


ALTER TYPE "public"."status_tournament" OWNER TO "postgres";


CREATE TYPE "public"."tournament_format" AS ENUM (
    'AMERICAN_2',
    'AMERICAN_3',
    'LONG'
);


ALTER TYPE "public"."tournament_format" OWNER TO "postgres";


CREATE TYPE "public"."tournament_type" AS ENUM (
    'LONG',
    'AMERICAN'
);


ALTER TYPE "public"."tournament_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."tournament_type" IS 'Tipo de torneo, largo o americano';



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
  
  -- 1. Source match debe ser PENDING o WAITING_OPONENT
  IF NOT EXISTS(SELECT 1 FROM matches WHERE id = p_source_match_id AND status IN ('PENDING', 'WAITING_OPONENT')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source match must be PENDING or WAITING_OPONENT status'
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


CREATE OR REPLACE FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text" DEFAULT NULL::"text", "start_date_param" "date" DEFAULT NULL::"date", "end_date_param" "date" DEFAULT NULL::"date", "is_qualifying_param" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    fecha_id UUID;
    next_number INTEGER;
BEGIN
    -- Get next fecha number
    next_number := get_next_fecha_number(tournament_uuid);
    
    -- Create the fecha
    INSERT INTO tournament_fechas (
        tournament_id, 
        fecha_number, 
        name, 
        description, 
        start_date, 
        end_date,
        is_qualifying
    )
    VALUES (
        tournament_uuid,
        next_number,
        fecha_name,
        fecha_description,
        start_date_param,
        end_date_param,
        is_qualifying_param
    )
    RETURNING id INTO fecha_id;
    
    RETURN fecha_id;
END;
$$;


ALTER FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text", "start_date_param" "date", "end_date_param" "date", "is_qualifying_param" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text", "start_date_param" "date", "end_date_param" "date", "is_qualifying_param" boolean) IS 'Creates a new fecha with automatic numbering and returns the fecha ID';



CREATE OR REPLACE FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(fecha_number) + 1 FROM tournament_fechas WHERE tournament_id = tournament_uuid),
        1
    );
END;
$$;


ALTER FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") IS 'Returns the next available fecha number for a tournament';



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



CREATE OR REPLACE FUNCTION "public"."initialize_match_hierarchy"("tournament_id_param" "uuid") RETURNS TABLE("hierarchy_count" bigint, "relationships_created" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  relationship_record RECORD;
  relationships text[] := '{}';
  total_created bigint := 0;
BEGIN
  -- Limpiar jerarquía existente para este torneo
  DELETE FROM match_hierarchy WHERE tournament_id = tournament_id_param;
  
  -- 8VOS → 4TOS: Matches 1,2 → Match 1; Matches 3,4 → Match 2; etc.
  FOR relationship_record IN
    SELECT 
      parent.id as parent_id,
      child.id as child_id,
      parent.round as parent_round,
      child.round as child_round,
      parent.order_in_round as parent_order,
      child.order_in_round as child_order,
      CASE 
        WHEN (child.order_in_round - 1) % 2 = 0 THEN 1  -- Impares van a slot 1
        ELSE 2                                           -- Pares van a slot 2  
      END as parent_slot
    FROM matches parent
    INNER JOIN matches child ON (
      parent.tournament_id = child.tournament_id 
      AND parent.round = '4TOS' 
      AND child.round = '8VOS'
      AND parent.order_in_round = CEIL(child.order_in_round::float / 2)
    )
    WHERE parent.tournament_id = tournament_id_param
  LOOP
    INSERT INTO match_hierarchy (
      parent_match_id, child_match_id, parent_slot,
      tournament_id, parent_round, child_round
    ) VALUES (
      relationship_record.parent_id, relationship_record.child_id, relationship_record.parent_slot,
      tournament_id_param, relationship_record.parent_round, relationship_record.child_round
    );
    
    relationships := array_append(relationships, 
      format('%s M%s → %s M%s (slot %s)', 
        relationship_record.child_round, relationship_record.child_order,
        relationship_record.parent_round, relationship_record.parent_order,
        relationship_record.parent_slot
      )
    );
    total_created := total_created + 1;
  END LOOP;
  
  -- Retornar estadísticas
  RETURN QUERY SELECT total_created, relationships;
END;
$$;


ALTER FUNCTION "public"."initialize_match_hierarchy"("tournament_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_bracket_byes"("p_tournament_id" "uuid", "p_match_ids" "uuid"[], "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  match_record RECORD;
  winner_couple_id uuid;
  processed_matches jsonb[] := '{}';
  propagated_winners jsonb[] := '{}';  
  processed_count integer := 0;
  parent_match_record RECORD;
  winner_names text := 'Unknown';
BEGIN
  -- Si no se especifican match_ids, buscar todos los matches con BYE
  IF array_length(p_match_ids, 1) IS NULL OR array_length(p_match_ids, 1) = 0 THEN
    SELECT array_agg(m.id) INTO p_match_ids
    FROM matches m
    WHERE m.tournament_id = p_tournament_id
      AND m.type = 'ELIMINATION'
      AND m.status IN ('PENDING', 'FINISHED')
      AND ((m.couple1_id IS NOT NULL AND m.couple2_id IS NULL) 
           OR (m.couple1_id IS NULL AND m.couple2_id IS NOT NULL));
  END IF;
  
  -- Si no hay matches para procesar, retornar vacío
  IF p_match_ids IS NULL OR array_length(p_match_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'processed_count', 0,
      'processed_matches', '[]'::jsonb,
      'propagated_winners', '[]'::jsonb
    );
  END IF;
  
  -- Procesar cada match con BYE
  FOR match_record IN
    SELECT 
      m.id, m.round, m.order_in_round, m."order",
      m.couple1_id, m.couple2_id, m.status
    FROM matches m
    WHERE m.id = ANY(p_match_ids)
      AND m.tournament_id = p_tournament_id
      AND ((m.couple1_id IS NOT NULL AND m.couple2_id IS NULL) 
           OR (m.couple1_id IS NULL AND m.couple2_id IS NOT NULL))
  LOOP
    -- Determinar ganador (la pareja que no es NULL)
    winner_couple_id := COALESCE(match_record.couple1_id, match_record.couple2_id);
    
    -- Solo procesar si el match no está ya finalizado
    IF match_record.status = 'PENDING' THEN
      -- Marcar match como finalizado con ganador automático
      UPDATE matches 
      SET status = 'FINISHED', 
          winner_id = winner_couple_id,
          result_couple1 = CASE WHEN match_record.couple1_id = winner_couple_id THEN 'W' ELSE 'BYE' END,
          result_couple2 = CASE WHEN match_record.couple2_id = winner_couple_id THEN 'W' ELSE 'BYE' END
      WHERE id = match_record.id;
      
      processed_count := processed_count + 1;
    END IF;
    
    -- PROPAGACIÓN: Buscar match padre y actualizar
    FOR parent_match_record IN
      SELECT 
        mh.parent_match_id,
        mh.parent_slot,
        pm.round as parent_round,
        pm.order_in_round as parent_order
      FROM match_hierarchy mh
      JOIN matches pm ON mh.parent_match_id = pm.id
      WHERE mh.child_match_id = match_record.id
        AND mh.tournament_id = p_tournament_id
    LOOP
      -- Actualizar el match padre con el ganador
      IF parent_match_record.parent_slot = 1 THEN
        UPDATE matches SET couple1_id = winner_couple_id WHERE id = parent_match_record.parent_match_id;
      ELSE
        UPDATE matches SET couple2_id = winner_couple_id WHERE id = parent_match_record.parent_match_id;
      END IF;
      
    END LOOP;
    
  END LOOP;
  
  -- Retornar resumen de operación
  RETURN jsonb_build_object(
    'processed_count', processed_count,
    'processed_matches', processed_matches,
    'propagated_winners', propagated_winners
  );
END;
$$;


ALTER FUNCTION "public"."process_bracket_byes"("p_tournament_id" "uuid", "p_match_ids" "uuid"[], "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_placeholders_atomic"("p_tournament_id" "uuid", "p_resolutions" "jsonb") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  resolution JSONB;
  seed_record RECORD;
  resolved_count INTEGER := 0;
  result JSON;
BEGIN
  -- Loop through each resolution
  FOR resolution IN SELECT value FROM jsonb_array_elements(p_resolutions)
  LOOP
    -- Find the placeholder seed to resolve
    SELECT tcs.* INTO seed_record
    FROM tournament_couple_seeds tcs
    WHERE tcs.tournament_id = p_tournament_id
      AND tcs.is_placeholder = TRUE
      AND tcs.placeholder_label = (resolution->>'placeholder_label')::text;
    
    IF FOUND THEN
      -- Resolve the placeholder
      UPDATE tournament_couple_seeds 
      SET 
        couple_id = (resolution->>'couple_id')::UUID,
        is_placeholder = FALSE,
        placeholder_zone_id = NULL,
        placeholder_position = NULL,
        placeholder_label = NULL,
        resolved_at = NOW()
      WHERE id = seed_record.id;
      
      -- Log the resolution in audit table
      INSERT INTO placeholder_resolutions (
        tournament_id, 
        seed_id, 
        placeholder_label, 
        resolved_couple_id,
        zone_id,
        zone_position,
        resolution_method
      ) VALUES (
        p_tournament_id,
        seed_record.id,
        seed_record.placeholder_label,
        (resolution->>'couple_id')::UUID,
        seed_record.placeholder_zone_id,
        seed_record.placeholder_position,
        (resolution->>'resolution_method')::text
      );
      
      resolved_count := resolved_count + 1;
      
    END IF;
  END LOOP;
  
  -- Return result summary
  result := json_build_object(
    'success', true,
    'resolved_count', resolved_count,
    'tournament_id', p_tournament_id
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to resolve placeholders: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."resolve_placeholders_atomic"("p_tournament_id" "uuid", "p_resolutions" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."swap_bracket_positions"("p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_source_couple_id" "uuid", "p_target_couple_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tournament_id uuid;
  v_source_bracket_position smallint;
  v_target_bracket_position smallint;
BEGIN
  -- Obtener tournament_id de los matches
  SELECT DISTINCT tournament_id INTO v_tournament_id
  FROM matches 
  WHERE id IN (p_source_match_id, p_target_match_id);
  
  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Tournament not found for matches';
  END IF;
  
  -- Obtener las posiciones actuales en bracket_position
  SELECT bracket_position INTO v_source_bracket_position
  FROM tournament_couple_seeds 
  WHERE tournament_id = v_tournament_id AND couple_id = p_source_couple_id;
  
  SELECT bracket_position INTO v_target_bracket_position  
  FROM tournament_couple_seeds
  WHERE tournament_id = v_tournament_id AND couple_id = p_target_couple_id;
  
  -- TRANSACCIÓN ATÓMICA: Intercambiar positions
  
  -- 1. Intercambiar couple_ids en matches
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = p_target_couple_id WHERE id = p_source_match_id;
  ELSE
    UPDATE matches SET couple2_id = p_target_couple_id WHERE id = p_source_match_id;
  END IF;
  
  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = p_source_couple_id WHERE id = p_target_match_id;
  ELSE
    UPDATE matches SET couple2_id = p_source_couple_id WHERE id = p_target_match_id;
  END IF;
  
  -- 2. Sincronizar bracket_position en tournament_couple_seeds (si existen)
  IF v_source_bracket_position IS NOT NULL AND v_target_bracket_position IS NOT NULL THEN
    UPDATE tournament_couple_seeds 
    SET bracket_position = v_target_bracket_position
    WHERE tournament_id = v_tournament_id AND couple_id = p_source_couple_id;
    
    UPDATE tournament_couple_seeds
    SET bracket_position = v_source_bracket_position  
    WHERE tournament_id = v_tournament_id AND couple_id = p_target_couple_id;
  END IF;
  
END;
$$;


ALTER FUNCTION "public"."swap_bracket_positions"("p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_source_couple_id" "uuid", "p_target_couple_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."swap_bracket_positions_atomic"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result jsonb;
  v_source_match record;
  v_target_match record;
  v_source_couple_id uuid;
  v_target_couple_id uuid;
  v_user_club_id uuid;
  v_tournament_club_id uuid;
  v_source_bracket_position smallint;
  v_target_bracket_position smallint;
BEGIN
  -- 🔒 CRITICAL: Lock matches to prevent race conditions
  -- This ensures data consistency during concurrent operations
  SELECT * INTO v_source_match 
  FROM matches 
  WHERE id = p_source_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;
  
  SELECT * INTO v_target_match 
  FROM matches 
  WHERE id = p_target_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;
  
  -- ✅ VALIDATION 1: Matches exist and belong to tournament
  IF v_source_match IS NULL OR v_target_match IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Matches not found or not in tournament',
      'operation_id', p_operation_id
    );
  END IF;
  
  -- ✅ VALIDATION 2: User permissions (club ownership)
  SELECT club_id INTO v_user_club_id 
  FROM user_details_v 
  WHERE id = p_user_id;
  
  SELECT club_id INTO v_tournament_club_id 
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF v_user_club_id IS NULL OR v_tournament_club_id IS NULL OR v_user_club_id != v_tournament_club_id THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient permissions - user must belong to tournament club',
      'operation_id', p_operation_id
    );
  END IF;
  
  -- ✅ VALIDATION 3: Same round requirement
  IF v_source_match.round != v_target_match.round THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Matches must be in the same round',
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'source_round', v_source_match.round,
        'target_round', v_target_match.round
      )
    );
  END IF;
  
  -- ✅ VALIDATION 4: Match status (must be PENDING)
  IF v_source_match.status != 'PENDING' OR v_target_match.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot move couples from/to matches that are not pending',
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'source_status', v_source_match.status,
        'target_status', v_target_match.status
      )
    );
  END IF;
  
  -- ✅ VALIDATION 5: Extract couple IDs (with FRESH data from locked records)
  IF p_source_slot = 'couple1_id' THEN
    v_source_couple_id := v_source_match.couple1_id;
  ELSIF p_source_slot = 'couple2_id' THEN
    v_source_couple_id := v_source_match.couple2_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid source slot - must be couple1_id or couple2_id',
      'operation_id', p_operation_id
    );
  END IF;
  
  IF p_target_slot = 'couple1_id' THEN
    v_target_couple_id := v_target_match.couple1_id;
  ELSIF p_target_slot = 'couple2_id' THEN
    v_target_couple_id := v_target_match.couple2_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid target slot - must be couple1_id or couple2_id',
      'operation_id', p_operation_id
    );
  END IF;
  
  -- ✅ VALIDATION 6: Both positions must have couples (no NULLs)
  IF v_source_couple_id IS NULL OR v_target_couple_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Both positions must have couples to swap',
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'source_couple_id', v_source_couple_id,
        'target_couple_id', v_target_couple_id,
        'source_slot', p_source_slot,
        'target_slot', p_target_slot
      )
    );
  END IF;
  
  -- ✅ VALIDATION 7: Not swapping to same position
  IF p_source_match_id = p_target_match_id AND p_source_slot = p_target_slot THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot move couple to the same position',
      'operation_id', p_operation_id
    );
  END IF;
  
  -- 🔄 ATOMIC SWAP OPERATION
  -- Update source match
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = v_target_couple_id WHERE id = p_source_match_id;
  ELSE
    UPDATE matches SET couple2_id = v_target_couple_id WHERE id = p_source_match_id;
  END IF;
  
  -- Update target match
  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = v_source_couple_id WHERE id = p_target_match_id;
  ELSE
    UPDATE matches SET couple2_id = v_source_couple_id WHERE id = p_target_match_id;
  END IF;
  
  -- 🎯 SYNC BRACKET POSITIONS (if they exist in tournament_couple_seeds)
  SELECT bracket_position INTO v_source_bracket_position
  FROM tournament_couple_seeds 
  WHERE tournament_id = p_tournament_id AND couple_id = v_source_couple_id;
  
  SELECT bracket_position INTO v_target_bracket_position  
  FROM tournament_couple_seeds
  WHERE tournament_id = p_tournament_id AND couple_id = v_target_couple_id;
  
  -- Only update bracket positions if both couples have seeds
  IF v_source_bracket_position IS NOT NULL AND v_target_bracket_position IS NOT NULL THEN
    UPDATE tournament_couple_seeds 
    SET bracket_position = v_target_bracket_position
    WHERE tournament_id = p_tournament_id AND couple_id = v_source_couple_id;
    
    UPDATE tournament_couple_seeds
    SET bracket_position = v_source_bracket_position  
    WHERE tournament_id = p_tournament_id AND couple_id = v_target_couple_id;
  END IF;
  
  -- 📝 AUDIT LOG (within same transaction)
  INSERT INTO audit_logs (user_id, tournament_id, action, details)
  VALUES (
    p_user_id, 
    p_tournament_id, 
    'swap_bracket_positions',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'source_match_id', p_source_match_id,
      'target_match_id', p_target_match_id,
      'source_slot', p_source_slot,
      'target_slot', p_target_slot,
      'source_couple_id', v_source_couple_id,
      'target_couple_id', v_target_couple_id,
      'source_bracket_position', v_source_bracket_position,
      'target_bracket_position', v_target_bracket_position,
      'timestamp', NOW()
    )
  );
  
  -- ✅ SUCCESS RESPONSE
  RETURN jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'details', jsonb_build_object(
      'swapped_couples', jsonb_build_object(
        'source', v_source_couple_id,
        'target', v_target_couple_id
      ),
      'bracket_positions_updated', (v_source_bracket_position IS NOT NULL AND v_target_bracket_position IS NOT NULL),
      'source_match_id', p_source_match_id,
      'target_match_id', p_target_match_id
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- 🚨 ERROR HANDLING with detailed logging
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM,
      'operation_id', p_operation_id,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."swap_bracket_positions_atomic"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_couple_availability_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_couple_availability_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_match_sets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_match_sets_updated_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_tournament_dates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tournament_dates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_zone_positions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_zone_positions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_system_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only allow system changes on NOT_STARTED tournaments
  IF OLD.uses_new_system != NEW.uses_new_system AND OLD.status != 'NOT_STARTED' THEN
    RAISE EXCEPTION 'Cannot change tournament system type after tournament has started. Current status: %', OLD.status;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_system_change"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "tournament_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_matches_20250825" (
    "id" "uuid",
    "created_at" timestamp with time zone,
    "couple1_id" "uuid",
    "couple2_id" "uuid",
    "result_couple1" "text",
    "result_couple2" "text",
    "tournament_id" "uuid",
    "winner_id" "uuid",
    "round" "public"."ROUND",
    "zone_id" "uuid",
    "status" "public"."match_status",
    "order" smallint,
    "image_url" "text",
    "es_prueba" boolean,
    "type" "text",
    "court" "text",
    "is_from_initial_generation" boolean
);


ALTER TABLE "public"."backup_matches_20250825" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_tournament_couple_seeds_20250825" (
    "tournament_id" "uuid",
    "couple_id" "uuid",
    "seed" smallint,
    "zone_id" "uuid",
    "es_prueba" boolean
);


ALTER TABLE "public"."backup_tournament_couple_seeds_20250825" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backup_tournaments_20250825" (
    "id" "uuid",
    "created_at" timestamp with time zone,
    "club_id" "uuid",
    "category_name" "text",
    "type" "public"."tournament_type",
    "gender" "public"."GENDER",
    "status" "public"."status_tournament",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "description" "text",
    "max_participants" smallint,
    "name" "text",
    "winner_id" "uuid",
    "price" smallint,
    "winner_image_url" "text",
    "pre_tournament_image_url" "text",
    "es_prueba" boolean
);


ALTER TABLE "public"."backup_tournaments_20250825" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bracket_operations_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "tournament_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "source_match_id" "uuid",
    "target_match_id" "uuid",
    "source_couple_id" "uuid",
    "target_couple_id" "uuid",
    "source_slot" "text",
    "target_slot" "text",
    "user_id" "uuid",
    "operation_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "bracket_operations_log_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['SWAP_POSITIONS'::"text", 'MOVE_TO_BYE'::"text", 'PROCESS_BYE'::"text", 'START_MATCH'::"text", 'ASSIGN_COURT'::"text", 'MODIFY_RESULT'::"text"])))
);


ALTER TABLE "public"."bracket_operations_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "name" "text" NOT NULL,
    "lower_range" integer NOT NULL,
    "upper_range" integer
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."categories" IS 'Tabla de categorias';



CREATE TABLE IF NOT EXISTS "public"."clubes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "address" "text",
    "user_id" "uuid",
    "instagram" "text",
    "score_reviews" numeric,
    "courts" smallint,
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "cover_image_url" "text",
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb",
    "phone" "text",
    "email" "text",
    "website" "text",
    "description" "text",
    "is_active" boolean DEFAULT false NOT NULL,
    "phone2" "text"
);


ALTER TABLE "public"."clubes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clubes"."user_id" IS 'foreign key hacia la tabla users, login para clubes';



COMMENT ON COLUMN "public"."clubes"."courts" IS 'number of courts';



COMMENT ON COLUMN "public"."clubes"."cover_image_url" IS 'URL of the main cover image for the club';



COMMENT ON COLUMN "public"."clubes"."gallery_images" IS 'JSON array of gallery image URLs';



CREATE TABLE IF NOT EXISTS "public"."coach_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255),
    "phone" character varying(50) NOT NULL,
    "email" character varying(255),
    "interest" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."coach_inquiries" OWNER TO "postgres";


COMMENT ON TABLE "public"."coach_inquiries" IS 'Tabla para almacenar consultas de entrenadores interesados en formar parte de la plataforma';



COMMENT ON COLUMN "public"."coach_inquiries"."name" IS 'Nombre completo del entrenador (opcional)';



COMMENT ON COLUMN "public"."coach_inquiries"."phone" IS 'Número de teléfono del entrenador (obligatorio)';



COMMENT ON COLUMN "public"."coach_inquiries"."email" IS 'Email del entrenador (opcional)';



COMMENT ON COLUMN "public"."coach_inquiries"."interest" IS 'Descripción de qué le gustaría hacer con la app (opcional)';



CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "last_name" "text",
    "player_id" "uuid" DEFAULT "gen_random_uuid"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


COMMENT ON TABLE "public"."coaches" IS 'tabla de entrenadores';



COMMENT ON COLUMN "public"."coaches"."user_id" IS 'foreign key hacia users';



CREATE TABLE IF NOT EXISTS "public"."couple_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "tournament_date_id" "uuid" NOT NULL,
    "couple_id" "uuid" NOT NULL,
    "is_available" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_notes_length" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 500)))
);


ALTER TABLE "public"."couple_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."couples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "player1_id" "uuid" DEFAULT "gen_random_uuid"(),
    "player2_id" "uuid" DEFAULT "gen_random_uuid"(),
    "es_prueba" boolean DEFAULT false
);


ALTER TABLE "public"."couples" OWNER TO "postgres";


COMMENT ON TABLE "public"."couples" IS 'tabla de parejas';



COMMENT ON COLUMN "public"."couples"."es_prueba" IS 'Campo para identificar parejas de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."dni_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dni" "text" NOT NULL,
    "existing_player_id" "uuid" NOT NULL,
    "new_player_id" "uuid",
    "new_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "admin_notes" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "phone" "text",
    CONSTRAINT "dni_conflicts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."dni_conflicts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "couple_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "is_pending" boolean DEFAULT false,
    "phone" "text",
    "es_prueba" boolean DEFAULT false
);


ALTER TABLE "public"."inscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inscriptions"."phone" IS 'Telefono de contacto para enviar solicitud de inscripcion';



COMMENT ON COLUMN "public"."inscriptions"."es_prueba" IS 'Campo para identificar inscripciones de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."match_hierarchy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_match_id" "uuid" NOT NULL,
    "child_match_id" "uuid" NOT NULL,
    "parent_slot" smallint NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "parent_round" "text" NOT NULL,
    "child_round" "text" NOT NULL,
    CONSTRAINT "match_hierarchy_parent_slot_check" CHECK (("parent_slot" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."match_hierarchy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_points_couples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "winner_couple_id" "uuid" NOT NULL,
    "loser_couple_id" "uuid" NOT NULL,
    "points_winner" integer NOT NULL,
    "points_loser" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."match_points_couples" OWNER TO "postgres";


COMMENT ON TABLE "public"."match_points_couples" IS 'Tabla para tracking de puntos ganados/perdidos por pareja en cada partido';



COMMENT ON COLUMN "public"."match_points_couples"."match_id" IS 'ID del partido';



COMMENT ON COLUMN "public"."match_points_couples"."winner_couple_id" IS 'ID de la pareja ganadora';



COMMENT ON COLUMN "public"."match_points_couples"."loser_couple_id" IS 'ID de la pareja perdedora';



COMMENT ON COLUMN "public"."match_points_couples"."points_winner" IS 'Puntos ganados por la pareja ganadora';



COMMENT ON COLUMN "public"."match_points_couples"."points_loser" IS 'Puntos perdidos por la pareja perdedora';



CREATE TABLE IF NOT EXISTS "public"."match_results_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "match_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "operation_type" "text" NOT NULL,
    "result_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "previous_status" "text",
    "new_status" "text",
    "previous_winner_id" "uuid",
    "new_winner_id" "uuid",
    "operation_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_current" boolean DEFAULT true,
    "reverted_at" timestamp with time zone,
    "reverted_by" "uuid",
    CONSTRAINT "match_results_history_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['ASSIGN_COURT'::"text", 'START_MATCH'::"text", 'UPDATE_RESULT'::"text", 'FINISH_MATCH'::"text", 'MODIFY_RESULT'::"text"])))
);


ALTER TABLE "public"."match_results_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "set_number" integer NOT NULL,
    "couple1_games" integer NOT NULL,
    "couple2_games" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_sets_couple1_games_check" CHECK ((("couple1_games" >= 0) AND ("couple1_games" <= 7))),
    CONSTRAINT "match_sets_couple2_games_check" CHECK ((("couple2_games" >= 0) AND ("couple2_games" <= 7))),
    CONSTRAINT "match_sets_set_number_check" CHECK ((("set_number" >= 1) AND ("set_number" <= 5))),
    CONSTRAINT "valid_set_score" CHECK (((("couple1_games" = 6) AND (("couple2_games" >= 0) AND ("couple2_games" <= 4))) OR (("couple2_games" = 6) AND (("couple1_games" >= 0) AND ("couple1_games" <= 4))) OR (("couple1_games" = 7) AND ("couple2_games" = 6)) OR (("couple2_games" = 7) AND ("couple1_games" = 6)) OR (("couple1_games" < 6) AND ("couple2_games" < 6))))
);


ALTER TABLE "public"."match_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "couple1_id" "uuid" DEFAULT "gen_random_uuid"(),
    "couple2_id" "uuid" DEFAULT "gen_random_uuid"(),
    "result_couple1" "text",
    "result_couple2" "text",
    "tournament_id" "uuid",
    "winner_id" "uuid",
    "round" "public"."ROUND",
    "zone_id" "uuid",
    "status" "public"."match_status" DEFAULT 'PENDING'::"public"."match_status",
    "order" smallint,
    "image_url" "text",
    "es_prueba" boolean DEFAULT false,
    "type" "text" DEFAULT 'ZONE'::"text",
    "court" "text",
    "is_from_initial_generation" boolean,
    "order_in_round" integer,
    "placeholder_couple1_label" "text",
    "placeholder_couple2_label" "text",
    "tournament_couple_seed1_id" "uuid",
    "tournament_couple_seed2_id" "uuid",
    CONSTRAINT "matches_type_check" CHECK (("type" = ANY (ARRAY['ZONE'::"text", 'ELIMINATION'::"text"])))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


COMMENT ON TABLE "public"."matches" IS 'tabla de partidos';



COMMENT ON COLUMN "public"."matches"."es_prueba" IS 'Campo para identificar partidos de prueba que no deben mostrarse en producción';



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


CREATE TABLE IF NOT EXISTS "public"."placeholder_resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "seed_id" "uuid" NOT NULL,
    "placeholder_label" "text" NOT NULL,
    "resolved_couple_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "zone_position" integer NOT NULL,
    "resolution_method" "text" DEFAULT 'AUTOMATIC'::"text",
    "resolved_at" timestamp with time zone DEFAULT "now"(),
    "resolved_by" "uuid",
    CONSTRAINT "placeholder_resolutions_resolution_method_check" CHECK (("resolution_method" = ANY (ARRAY['AUTOMATIC'::"text", 'MANUAL'::"text", 'FORCED'::"text"]))),
    CONSTRAINT "placeholder_resolutions_zone_position_check" CHECK ((("zone_position" >= 1) AND ("zone_position" <= 4)))
);


ALTER TABLE "public"."placeholder_resolutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_recategorizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "tournament_id" "uuid",
    "old_category_name" "text" NOT NULL,
    "new_category_name" "text" NOT NULL,
    "old_score" integer NOT NULL,
    "new_score" integer NOT NULL,
    "recategorized_by" "uuid" NOT NULL,
    "reason" "text",
    "tournament_context" boolean DEFAULT false NOT NULL,
    "es_prueba" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."player_recategorizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_tournament_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "points_before" integer DEFAULT 0 NOT NULL,
    "points_after" integer DEFAULT 0 NOT NULL,
    "points_earned" integer DEFAULT 0 NOT NULL,
    "rank_before" integer,
    "rank_after" integer,
    "rank_change" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "es_prueba" boolean DEFAULT false
);


ALTER TABLE "public"."player_tournament_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."player_tournament_history"."es_prueba" IS 'Campo para identificar historiales de torneo de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "score" numeric,
    "category_name" "text",
    "club_id" "uuid",
    "dni" "text",
    "preferred_hand" "text",
    "racket" "text",
    "gender" "public"."GENDER",
    "preferred_side" "public"."PREFERRED_SIDE",
    "user_id" "uuid",
    "phone" "text",
    "date_of_birth" "date",
    "profile_image_url" "text",
    "instagram_handle" "text",
    "address" "text",
    "status" "text" DEFAULT 'active'::"text",
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb",
    "is_categorized" boolean DEFAULT false,
    "description" "text",
    "es_prueba" boolean DEFAULT false,
    CONSTRAINT "players_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."players" OWNER TO "postgres";


COMMENT ON COLUMN "public"."players"."preferred_side" IS 'Lado preferido para jugar, reves o drive';



COMMENT ON COLUMN "public"."players"."user_id" IS 'foreign key hacia la tabla users';



COMMENT ON COLUMN "public"."players"."date_of_birth" IS 'fecha de nacimiento';



COMMENT ON COLUMN "public"."players"."profile_image_url" IS 'URL of the player profile image';



COMMENT ON COLUMN "public"."players"."instagram_handle" IS 'Instagram handle without @';



COMMENT ON COLUMN "public"."players"."address" IS 'Player address or location';



COMMENT ON COLUMN "public"."players"."status" IS 'Player status: active or inactive';



COMMENT ON COLUMN "public"."players"."gallery_images" IS 'JSON array of gallery image URLs';



COMMENT ON COLUMN "public"."players"."es_prueba" IS 'Campo para identificar jugadores de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."ranking_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "week_start_date" "date",
    "tournament_id" "uuid",
    "snapshot_type" "text" DEFAULT 'weekly'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "player_name" "text",
    "rank_position" integer,
    "es_prueba" boolean DEFAULT false,
    CONSTRAINT "ranking_snapshots_snapshot_type_check" CHECK (("snapshot_type" = ANY (ARRAY['weekly'::"text", 'tournament_start'::"text"])))
);


ALTER TABLE "public"."ranking_snapshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ranking_snapshots"."category" IS 'Player category at the moment of snapshot';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "player_id" "uuid" NOT NULL,
    "club_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "score" numeric,
    "review_description" "text"
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."reviews" IS 'users can score clubes';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON TABLE "public"."services" IS 'Table of services for clubes';



CREATE TABLE IF NOT EXISTS "public"."services_clubes" (
    "service_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL
);


ALTER TABLE "public"."services_clubes" OWNER TO "postgres";


COMMENT ON TABLE "public"."services_clubes" IS 'Intermediate table of services and clubes';



CREATE TABLE IF NOT EXISTS "public"."tournament_couple_seeds" (
    "tournament_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" DEFAULT "gen_random_uuid"(),
    "seed" smallint NOT NULL,
    "es_prueba" boolean DEFAULT false,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bracket_position" smallint,
    "is_placeholder" boolean DEFAULT false,
    "placeholder_zone_id" "uuid",
    "placeholder_position" integer,
    "placeholder_label" "text",
    "created_as_placeholder" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "tournament_couple_seeds_placeholder_position_check" CHECK ((("placeholder_position" IS NULL) OR (("placeholder_position" >= 1) AND ("placeholder_position" <= 4))))
);


ALTER TABLE "public"."tournament_couple_seeds" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournament_couple_seeds" IS 'tabla para rankear a las parejas en las llaves';



COMMENT ON COLUMN "public"."tournament_couple_seeds"."es_prueba" IS 'Campo para identificar seeds de parejas de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."tournament_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_description_length" CHECK (("char_length"("description") <= 100)),
    CONSTRAINT "valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."tournament_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "club_id" "uuid" DEFAULT "gen_random_uuid"(),
    "category_name" "text",
    "type" "public"."tournament_type",
    "gender" "public"."GENDER" DEFAULT 'MALE'::"public"."GENDER",
    "status" "public"."status_tournament" DEFAULT 'NOT_STARTED'::"public"."status_tournament",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "description" "text",
    "max_participants" smallint,
    "name" "text",
    "winner_id" "uuid",
    "price" smallint,
    "winner_image_url" "text",
    "pre_tournament_image_url" "text",
    "es_prueba" boolean DEFAULT false,
    "allows_placeholder_brackets" boolean DEFAULT true,
    "placeholder_brackets_generated_at" timestamp with time zone,
    "bracket_status" "public"."bracket_status" DEFAULT 'NOT_STARTED'::"public"."bracket_status",
    "registration_locked" boolean DEFAULT false,
    "bracket_generated_at" timestamp with time zone,
    "uses_new_system" boolean DEFAULT false NOT NULL,
    "last_bracket_update" timestamp without time zone,
    "uses_new_zone_system" boolean DEFAULT false,
    "format_type" "public"."tournament_format" DEFAULT 'AMERICAN_2'::"public"."tournament_format",
    "format_config" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "tournaments_price_check" CHECK (("price" >= 0))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournaments" IS 'Tournament management with explicit system type control via uses_new_system field';



COMMENT ON COLUMN "public"."tournaments"."type" IS 'Tipo de torneo';



COMMENT ON COLUMN "public"."tournaments"."status" IS 'Status of tournament';



COMMENT ON COLUMN "public"."tournaments"."start_date" IS 'Fecha de inicio';



COMMENT ON COLUMN "public"."tournaments"."description" IS 'Premios y demás info.';



COMMENT ON COLUMN "public"."tournaments"."max_participants" IS 'Numero maximo de participantes.';



COMMENT ON COLUMN "public"."tournaments"."name" IS 'nombre especial del torneo';



COMMENT ON COLUMN "public"."tournaments"."winner_id" IS 'id of couple that won the tournament';



COMMENT ON COLUMN "public"."tournaments"."price" IS 'price of tournament';



COMMENT ON COLUMN "public"."tournaments"."es_prueba" IS 'Campo para identificar torneos de prueba que no deben mostrarse en producción';



COMMENT ON COLUMN "public"."tournaments"."bracket_status" IS 'Current state of bracket generation (NOT_STARTED, REGISTRATION_LOCKED, BRACKET_GENERATED, BRACKET_ACTIVE)';



COMMENT ON COLUMN "public"."tournaments"."registration_locked" IS 'Whether new couple registrations are allowed';



COMMENT ON COLUMN "public"."tournaments"."bracket_generated_at" IS 'Timestamp when bracket was first generated';



COMMENT ON COLUMN "public"."tournaments"."uses_new_system" IS 'Explicitly controls which tournament system to use: false = legacy (zones + zone_couples), true = new system (zone_positions + advanced features)';



COMMENT ON COLUMN "public"."tournaments"."last_bracket_update" IS 'Timestamp of last bracket update';



COMMENT ON COLUMN "public"."tournaments"."uses_new_zone_system" IS 'Flag to control tournament behavior: FALSE = legacy system (zones + zone_couples), TRUE = new system (zone_positions + restrictions)';



COMMENT ON COLUMN "public"."tournaments"."format_type" IS 'Tournament format: AMERICAN_2 (2 rounds per zone), AMERICAN_3 (3 rounds per zone), LONG (full round-robin)';



COMMENT ON COLUMN "public"."tournaments"."format_config" IS 'JSON configuration specific to tournament format';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "role" "public"."ROLE",
    "avatar_url" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Tabla de usuarios, de todos los roles';



CREATE OR REPLACE VIEW "public"."user_details_v" AS
 SELECT "u"."id",
    "u"."email",
    "u"."role",
    "u"."avatar_url",
    "u"."created_at",
    "p"."id" AS "player_id",
    "c"."id" AS "club_id",
    "co"."id" AS "coach_id",
    "p"."status" AS "player_status"
   FROM ((("public"."users" "u"
     LEFT JOIN "public"."players" "p" ON (("p"."user_id" = "u"."id")))
     LEFT JOIN "public"."clubes" "c" ON (("c"."user_id" = "u"."id")))
     LEFT JOIN "public"."coaches" "co" ON (("co"."user_id" = "u"."id")));


ALTER TABLE "public"."user_details_v" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_placeholder_consistency" AS
 SELECT "t"."id" AS "tournament_id",
    "t"."name" AS "tournament_name",
    "count"("tcs"."id") AS "total_seeds",
    "count"("pr"."id") AS "resolved_placeholders",
    ("count"("tcs"."id") - "count"("pr"."id")) AS "unresolved_placeholders",
        CASE
            WHEN ("count"("tcs"."id") = 0) THEN 'NO_SEEDS'::"text"
            WHEN ("count"("pr"."id") = "count"("tcs"."id")) THEN 'ALL_RESOLVED'::"text"
            WHEN ("count"("pr"."id") = 0) THEN 'NONE_RESOLVED'::"text"
            ELSE 'PARTIALLY_RESOLVED'::"text"
        END AS "status"
   FROM (("public"."tournaments" "t"
     LEFT JOIN "public"."tournament_couple_seeds" "tcs" ON (("t"."id" = "tcs"."tournament_id")))
     LEFT JOIN "public"."placeholder_resolutions" "pr" ON (("tcs"."id" = "pr"."seed_id")))
  GROUP BY "t"."id", "t"."name";


ALTER TABLE "public"."v_placeholder_consistency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_couples" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "zone_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "couple_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "es_prueba" boolean DEFAULT false
);


ALTER TABLE "public"."zone_couples" OWNER TO "postgres";


COMMENT ON TABLE "public"."zone_couples" IS 'Intermediate table';



COMMENT ON COLUMN "public"."zone_couples"."es_prueba" IS 'Campo para identificar relaciones zona-pareja de prueba que no deben mostrarse en producción';



CREATE TABLE IF NOT EXISTS "public"."zone_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid",
    "zone_id" "uuid",
    "couple_id" "uuid",
    "position" integer NOT NULL,
    "is_definitive" boolean DEFAULT false,
    "points" integer DEFAULT 0,
    "wins" integer DEFAULT 0,
    "losses" integer DEFAULT 0,
    "games_for" integer DEFAULT 0,
    "games_against" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "games_difference" integer DEFAULT 0 NOT NULL,
    "player_score_total" integer DEFAULT 0 NOT NULL,
    "tie_info" "text",
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zone_positions_position_check" CHECK ((("position" >= 1) AND ("position" <= 4)))
);


ALTER TABLE "public"."zone_positions" OWNER TO "postgres";


COMMENT ON TABLE "public"."zone_positions" IS 'Stores calculated positions and statistics for couples within tournament zones';



COMMENT ON COLUMN "public"."zone_positions"."position" IS 'Final calculated position within the zone (1 = first place)';



COMMENT ON COLUMN "public"."zone_positions"."is_definitive" IS 'True if position is final and cannot change';



COMMENT ON COLUMN "public"."zone_positions"."points" IS 'Sets difference (sets won - sets lost) used for ranking';



COMMENT ON COLUMN "public"."zone_positions"."games_difference" IS 'Games difference used as tiebreaker';



COMMENT ON COLUMN "public"."zone_positions"."player_score_total" IS 'Sum of both players scores used as tiebreaker';



COMMENT ON COLUMN "public"."zone_positions"."tie_info" IS 'Human-readable description of how ties were resolved';



CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tournament_id" "uuid" DEFAULT "gen_random_uuid"(),
    "name" "text",
    "es_prueba" boolean DEFAULT false,
    "capacity" smallint,
    "max_couples" integer DEFAULT 4,
    "rounds_per_couple" integer DEFAULT 2
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


COMMENT ON TABLE "public"."zones" IS 'Table of zones';



COMMENT ON COLUMN "public"."zones"."es_prueba" IS 'Campo para identificar zonas de prueba que no deben mostrarse en producción';



COMMENT ON COLUMN "public"."zones"."capacity" IS 'number of couples';



COMMENT ON COLUMN "public"."zones"."max_couples" IS 'Maximum number of couples allowed in this zone';



COMMENT ON COLUMN "public"."zones"."rounds_per_couple" IS 'Number of rounds each couple plays in this zone';



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "category_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."clubes"
    ADD CONSTRAINT "clubes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubes"
    ADD CONSTRAINT "clubes_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."coach_inquiries"
    ADD CONSTRAINT "coach_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coachs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_availability"
    ADD CONSTRAINT "couple_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."couple_availability"
    ADD CONSTRAINT "couple_availability_tournament_date_id_couple_id_key" UNIQUE ("tournament_date_id", "couple_id");



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dni_conflicts"
    ADD CONSTRAINT "dni_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inscriptions"
    ADD CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_hierarchy"
    ADD CONSTRAINT "match_hierarchy_child_match_id_key" UNIQUE ("child_match_id");



ALTER TABLE ONLY "public"."match_hierarchy"
    ADD CONSTRAINT "match_hierarchy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_points_couples"
    ADD CONSTRAINT "match_points_couples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_sets"
    ADD CONSTRAINT "match_sets_match_id_set_number_key" UNIQUE ("match_id", "set_number");



ALTER TABLE ONLY "public"."match_sets"
    ADD CONSTRAINT "match_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matchs_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_tournament_history"
    ADD CONSTRAINT "player_tournament_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_tournament_history"
    ADD CONSTRAINT "player_tournament_history_player_id_tournament_id_key" UNIQUE ("player_id", "tournament_id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ranking_snapshots"
    ADD CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ranking_snapshots"
    ADD CONSTRAINT "ranking_snapshots_player_id_week_start_date_snapshot_type_key" UNIQUE ("player_id", "week_start_date", "snapshot_type");



ALTER TABLE ONLY "public"."services_clubes"
    ADD CONSTRAINT "services_clubes_pkey" PRIMARY KEY ("service_id", "club_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_couple_seeds"
    ADD CONSTRAINT "tournament_couple_seeds_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."tournament_couple_seeds"
    ADD CONSTRAINT "tournament_couple_seeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_couple_seeds"
    ADD CONSTRAINT "tournament_couple_seeds_tournament_id_seed_unique" UNIQUE ("tournament_id", "seed");



ALTER TABLE ONLY "public"."tournament_dates"
    ADD CONSTRAINT "tournament_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournament_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_couples"
    ADD CONSTRAINT "zone_couples_pkey" PRIMARY KEY ("zone_id", "couple_id");



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_tournament_id" ON "public"."audit_logs" USING "btree" ("tournament_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_bracket_operations_log_executed_at" ON "public"."bracket_operations_log" USING "btree" ("executed_at");



CREATE INDEX "idx_bracket_operations_log_operation_type" ON "public"."bracket_operations_log" USING "btree" ("operation_type");



CREATE INDEX "idx_bracket_operations_log_tournament_id" ON "public"."bracket_operations_log" USING "btree" ("tournament_id");



CREATE INDEX "idx_coach_inquiries_created_at" ON "public"."coach_inquiries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_coach_inquiries_phone" ON "public"."coach_inquiries" USING "btree" ("phone");



CREATE INDEX "idx_couple_availability_available" ON "public"."couple_availability" USING "btree" ("is_available") WHERE ("is_available" = true);



CREATE INDEX "idx_couple_availability_couple_id" ON "public"."couple_availability" USING "btree" ("couple_id");



CREATE INDEX "idx_couple_availability_tournament_date_id" ON "public"."couple_availability" USING "btree" ("tournament_date_id");



CREATE INDEX "idx_couple_availability_tournament_id" ON "public"."couple_availability" USING "btree" ("tournament_id");



CREATE INDEX "idx_couples_es_prueba" ON "public"."couples" USING "btree" ("es_prueba");



CREATE INDEX "idx_dni_conflicts_dni" ON "public"."dni_conflicts" USING "btree" ("dni");



CREATE INDEX "idx_dni_conflicts_status" ON "public"."dni_conflicts" USING "btree" ("status");



CREATE INDEX "idx_inscriptions_es_prueba" ON "public"."inscriptions" USING "btree" ("es_prueba");



CREATE INDEX "idx_inscriptions_tournament_player_optimized" ON "public"."inscriptions" USING "btree" ("tournament_id", "player_id");



CREATE INDEX "idx_match_hierarchy_child_match_id" ON "public"."match_hierarchy" USING "btree" ("child_match_id");



CREATE INDEX "idx_match_hierarchy_parent_match_id" ON "public"."match_hierarchy" USING "btree" ("parent_match_id");



CREATE INDEX "idx_match_hierarchy_tournament_id" ON "public"."match_hierarchy" USING "btree" ("tournament_id");



CREATE INDEX "idx_match_results_history_created_at" ON "public"."match_results_history" USING "btree" ("created_at");



CREATE INDEX "idx_match_results_history_is_current" ON "public"."match_results_history" USING "btree" ("is_current");



CREATE INDEX "idx_match_results_history_match_id" ON "public"."match_results_history" USING "btree" ("match_id");



CREATE INDEX "idx_match_results_history_tournament_id" ON "public"."match_results_history" USING "btree" ("tournament_id");



CREATE INDEX "idx_match_sets_match_id" ON "public"."match_sets" USING "btree" ("match_id");



CREATE INDEX "idx_match_sets_set_number" ON "public"."match_sets" USING "btree" ("set_number");



CREATE INDEX "idx_matches_couple_zone_status" ON "public"."matches" USING "btree" ("couple1_id", "couple2_id", "round", "status", "tournament_id");



CREATE INDEX "idx_matches_es_prueba" ON "public"."matches" USING "btree" ("es_prueba");



CREATE INDEX "idx_matches_order_in_round" ON "public"."matches" USING "btree" ("order_in_round");



CREATE INDEX "idx_matches_tournament_couple_seed1_id" ON "public"."matches" USING "btree" ("tournament_couple_seed1_id");



CREATE INDEX "idx_matches_tournament_couple_seed2_id" ON "public"."matches" USING "btree" ("tournament_couple_seed2_id");



CREATE INDEX "idx_matches_tournament_status_optimized" ON "public"."matches" USING "btree" ("tournament_id", "status") WHERE ("status" IS NOT NULL);



CREATE INDEX "idx_organizaciones_active" ON "public"."organizaciones" USING "btree" ("is_active");



CREATE INDEX "idx_organizaciones_name" ON "public"."organizaciones" USING "btree" ("name");



CREATE INDEX "idx_organization_clubs_club" ON "public"."organization_clubs" USING "btree" ("club_id");



CREATE INDEX "idx_organization_clubs_organizacion" ON "public"."organization_clubs" USING "btree" ("organizacion_id");



CREATE INDEX "idx_organization_members_active" ON "public"."organization_members" USING "btree" ("is_active");



CREATE INDEX "idx_organization_members_organizacion" ON "public"."organization_members" USING "btree" ("organizacion_id");



CREATE INDEX "idx_organization_members_role" ON "public"."organization_members" USING "btree" ("member_role");



CREATE INDEX "idx_organization_members_user" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_placeholder_resolutions_seed_id" ON "public"."placeholder_resolutions" USING "btree" ("seed_id");



CREATE INDEX "idx_placeholder_resolutions_tournament_id" ON "public"."placeholder_resolutions" USING "btree" ("tournament_id");



CREATE INDEX "idx_placeholder_resolutions_zone_id" ON "public"."placeholder_resolutions" USING "btree" ("zone_id");



CREATE INDEX "idx_player_recategorizations_created_at" ON "public"."player_recategorizations" USING "btree" ("created_at");



CREATE INDEX "idx_player_recategorizations_player_id" ON "public"."player_recategorizations" USING "btree" ("player_id");



CREATE INDEX "idx_player_recategorizations_recategorized_by" ON "public"."player_recategorizations" USING "btree" ("recategorized_by");



CREATE INDEX "idx_player_recategorizations_tournament_id" ON "public"."player_recategorizations" USING "btree" ("tournament_id");



CREATE INDEX "idx_player_tournament_history_es_prueba" ON "public"."player_tournament_history" USING "btree" ("es_prueba");



CREATE INDEX "idx_player_tournament_history_player" ON "public"."player_tournament_history" USING "btree" ("player_id");



CREATE INDEX "idx_player_tournament_history_player_prueba" ON "public"."player_tournament_history" USING "btree" ("player_id", "es_prueba");



CREATE INDEX "idx_player_tournament_history_tournament" ON "public"."player_tournament_history" USING "btree" ("tournament_id");



CREATE INDEX "idx_players_category_score" ON "public"."players" USING "btree" ("category_name", "score" DESC NULLS LAST);



CREATE INDEX "idx_players_club_score" ON "public"."players" USING "btree" ("club_id", "score" DESC NULLS LAST);



CREATE INDEX "idx_players_es_prueba" ON "public"."players" USING "btree" ("es_prueba");



CREATE INDEX "idx_players_score" ON "public"."players" USING "btree" ("score" DESC NULLS LAST);



CREATE INDEX "idx_players_user_gender_optimized" ON "public"."players" USING "btree" ("user_id", "gender") WHERE ("gender" IS NOT NULL);



CREATE INDEX "idx_ranking_snapshots_player_tournament" ON "public"."ranking_snapshots" USING "btree" ("player_id", "tournament_id");



CREATE INDEX "idx_ranking_snapshots_player_week" ON "public"."ranking_snapshots" USING "btree" ("player_id", "week_start_date");



CREATE INDEX "idx_ranking_snapshots_tournament" ON "public"."ranking_snapshots" USING "btree" ("tournament_id", "snapshot_type");



CREATE INDEX "idx_ranking_snapshots_tournament_type" ON "public"."ranking_snapshots" USING "btree" ("tournament_id", "snapshot_type");



CREATE INDEX "idx_ranking_snapshots_week" ON "public"."ranking_snapshots" USING "btree" ("week_start_date");



CREATE INDEX "idx_tournament_couple_seeds_es_prueba" ON "public"."tournament_couple_seeds" USING "btree" ("es_prueba");



CREATE INDEX "idx_tournament_couple_seeds_is_placeholder" ON "public"."tournament_couple_seeds" USING "btree" ("is_placeholder");



CREATE INDEX "idx_tournament_couple_seeds_placeholder_zone_id" ON "public"."tournament_couple_seeds" USING "btree" ("placeholder_zone_id");



CREATE INDEX "idx_tournament_couple_seeds_tournament_prueba" ON "public"."tournament_couple_seeds" USING "btree" ("tournament_id", "es_prueba");



CREATE INDEX "idx_tournament_dates_active" ON "public"."tournament_dates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_tournament_dates_date" ON "public"."tournament_dates" USING "btree" ("date");



CREATE INDEX "idx_tournament_dates_tournament_id" ON "public"."tournament_dates" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournaments_bracket_status" ON "public"."tournaments" USING "btree" ("bracket_status");



CREATE INDEX "idx_tournaments_es_prueba" ON "public"."tournaments" USING "btree" ("es_prueba");



CREATE INDEX "idx_tournaments_format_type" ON "public"."tournaments" USING "btree" ("format_type");



CREATE INDEX "idx_tournaments_status_date_optimized" ON "public"."tournaments" USING "btree" ("status", "start_date") WHERE (("status" IS NOT NULL) AND ("start_date" IS NOT NULL));



CREATE INDEX "idx_tournaments_uses_new_system" ON "public"."tournaments" USING "btree" ("uses_new_system");



CREATE INDEX "idx_tournaments_zone_system" ON "public"."tournaments" USING "btree" ("uses_new_zone_system", "status");



CREATE INDEX "idx_users_role_optimized" ON "public"."users" USING "btree" ("role") WHERE ("role" IS NOT NULL);



CREATE INDEX "idx_zone_couples_es_prueba" ON "public"."zone_couples" USING "btree" ("es_prueba");



CREATE INDEX "idx_zone_couples_zone_prueba" ON "public"."zone_couples" USING "btree" ("zone_id", "es_prueba");



CREATE INDEX "idx_zone_positions_couple" ON "public"."zone_positions" USING "btree" ("couple_id");



CREATE INDEX "idx_zone_positions_couple_id" ON "public"."zone_positions" USING "btree" ("couple_id");



CREATE INDEX "idx_zone_positions_definitive" ON "public"."zone_positions" USING "btree" ("tournament_id", "is_definitive");



CREATE INDEX "idx_zone_positions_is_definitive" ON "public"."zone_positions" USING "btree" ("is_definitive");



CREATE INDEX "idx_zone_positions_tournament_id" ON "public"."zone_positions" USING "btree" ("tournament_id");



CREATE INDEX "idx_zone_positions_tournament_zone" ON "public"."zone_positions" USING "btree" ("tournament_id", "zone_id");



CREATE INDEX "idx_zone_positions_zone_id" ON "public"."zone_positions" USING "btree" ("zone_id");



CREATE INDEX "idx_zone_positions_zone_position" ON "public"."zone_positions" USING "btree" ("zone_id", "position");



CREATE INDEX "idx_zones_es_prueba" ON "public"."zones" USING "btree" ("es_prueba");



CREATE INDEX "match_points_couples_created_at_idx" ON "public"."match_points_couples" USING "btree" ("created_at");



CREATE INDEX "match_points_couples_loser_couple_id_idx" ON "public"."match_points_couples" USING "btree" ("loser_couple_id");



CREATE INDEX "match_points_couples_match_id_idx" ON "public"."match_points_couples" USING "btree" ("match_id");



CREATE INDEX "match_points_couples_winner_couple_id_idx" ON "public"."match_points_couples" USING "btree" ("winner_couple_id");



CREATE OR REPLACE TRIGGER "trg_validate_tournament_system_change" BEFORE UPDATE OF "uses_new_system" ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_system_change"();



CREATE OR REPLACE TRIGGER "trigger_couple_availability_updated_at" BEFORE UPDATE ON "public"."couple_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_couple_availability_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_match_sets_updated_at" BEFORE UPDATE ON "public"."match_sets" FOR EACH ROW EXECUTE FUNCTION "public"."update_match_sets_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_tournament_dates_updated_at" BEFORE UPDATE ON "public"."tournament_dates" FOR EACH ROW EXECUTE FUNCTION "public"."update_tournament_dates_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_zone_positions_updated_at" BEFORE UPDATE ON "public"."zone_positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_zone_positions_updated_at"();



CREATE OR REPLACE TRIGGER "update_zone_positions_updated_at" BEFORE UPDATE ON "public"."zone_positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_source_couple_id_fkey" FOREIGN KEY ("source_couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_source_match_id_fkey" FOREIGN KEY ("source_match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_target_couple_id_fkey" FOREIGN KEY ("target_couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_target_match_id_fkey" FOREIGN KEY ("target_match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."bracket_operations_log"
    ADD CONSTRAINT "bracket_operations_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."clubes"
    ADD CONSTRAINT "clubes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coachs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."couple_availability"
    ADD CONSTRAINT "couple_availability_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_availability"
    ADD CONSTRAINT "couple_availability_tournament_date_id_fkey" FOREIGN KEY ("tournament_date_id") REFERENCES "public"."tournament_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couple_availability"
    ADD CONSTRAINT "couple_availability_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."couples"
    ADD CONSTRAINT "couples_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."dni_conflicts"
    ADD CONSTRAINT "dni_conflicts_existing_player_id_fkey" FOREIGN KEY ("existing_player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."dni_conflicts"
    ADD CONSTRAINT "dni_conflicts_new_player_id_fkey" FOREIGN KEY ("new_player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."dni_conflicts"
    ADD CONSTRAINT "dni_conflicts_new_user_id_fkey" FOREIGN KEY ("new_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."dni_conflicts"
    ADD CONSTRAINT "dni_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "fk_matches_tournament_couple_seed1" FOREIGN KEY ("tournament_couple_seed1_id") REFERENCES "public"."tournament_couple_seeds"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "fk_matches_tournament_couple_seed2" FOREIGN KEY ("tournament_couple_seed2_id") REFERENCES "public"."tournament_couple_seeds"("id");



ALTER TABLE ONLY "public"."tournament_couple_seeds"
    ADD CONSTRAINT "fk_tournament_couple_seeds_couple_id" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inscriptions"
    ADD CONSTRAINT "inscriptions_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."inscriptions"
    ADD CONSTRAINT "inscriptions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."inscriptions"
    ADD CONSTRAINT "inscriptions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."match_hierarchy"
    ADD CONSTRAINT "match_hierarchy_child_match_id_fkey" FOREIGN KEY ("child_match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."match_hierarchy"
    ADD CONSTRAINT "match_hierarchy_parent_match_id_fkey" FOREIGN KEY ("parent_match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."match_hierarchy"
    ADD CONSTRAINT "match_hierarchy_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."match_points_couples"
    ADD CONSTRAINT "match_points_couples_loser_couple_id_fkey" FOREIGN KEY ("loser_couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_points_couples"
    ADD CONSTRAINT "match_points_couples_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_points_couples"
    ADD CONSTRAINT "match_points_couples_winner_couple_id_fkey" FOREIGN KEY ("winner_couple_id") REFERENCES "public"."couples"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_new_winner_id_fkey" FOREIGN KEY ("new_winner_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_previous_winner_id_fkey" FOREIGN KEY ("previous_winner_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_reverted_by_fkey" FOREIGN KEY ("reverted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."match_results_history"
    ADD CONSTRAINT "match_results_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."match_sets"
    ADD CONSTRAINT "match_sets_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_couple1_id_fkey" FOREIGN KEY ("couple1_id") REFERENCES "public"."couples"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_couple2_id_fkey" FOREIGN KEY ("couple2_id") REFERENCES "public"."couples"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."organization_clubs"
    ADD CONSTRAINT "organization_clubs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_clubs"
    ADD CONSTRAINT "organization_clubs_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_resolved_couple_id_fkey" FOREIGN KEY ("resolved_couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_seed_id_fkey" FOREIGN KEY ("seed_id") REFERENCES "public"."tournament_couple_seeds"("id");



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."placeholder_resolutions"
    ADD CONSTRAINT "placeholder_resolutions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_new_category_name_fkey" FOREIGN KEY ("new_category_name") REFERENCES "public"."categories"("name");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_old_category_name_fkey" FOREIGN KEY ("old_category_name") REFERENCES "public"."categories"("name");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_recategorized_by_fkey" FOREIGN KEY ("recategorized_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."player_recategorizations"
    ADD CONSTRAINT "player_recategorizations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."player_tournament_history"
    ADD CONSTRAINT "player_tournament_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_tournament_history"
    ADD CONSTRAINT "player_tournament_history_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_category_name_fkey" FOREIGN KEY ("category_name") REFERENCES "public"."categories"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubes"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."ranking_snapshots"
    ADD CONSTRAINT "ranking_snapshots_category_fkey" FOREIGN KEY ("category") REFERENCES "public"."categories"("name");



ALTER TABLE ONLY "public"."ranking_snapshots"
    ADD CONSTRAINT "ranking_snapshots_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ranking_snapshots"
    ADD CONSTRAINT "ranking_snapshots_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubes"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."services_clubes"
    ADD CONSTRAINT "services_clubes_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services_clubes"
    ADD CONSTRAINT "services_clubes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_couple_seeds"
    ADD CONSTRAINT "tournament_couple_seeds_placeholder_zone_id_fkey" FOREIGN KEY ("placeholder_zone_id") REFERENCES "public"."zones"("id");



ALTER TABLE ONLY "public"."tournament_dates"
    ADD CONSTRAINT "tournament_dates_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_category_name_fkey" FOREIGN KEY ("category_name") REFERENCES "public"."categories"("name") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubes"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."couples"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_couples"
    ADD CONSTRAINT "zone_couples_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_couples"
    ADD CONSTRAINT "zone_couples_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_couple_id_fkey" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id");



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id");



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON UPDATE CASCADE;



CREATE POLICY "Authenticated users can create organizations" ON "public"."organizaciones" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Club owners can insert bracket operations" ON "public"."bracket_operations_log" FOR INSERT WITH CHECK (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Club owners can insert match results history" ON "public"."match_results_history" FOR INSERT WITH CHECK (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Club owners can insert placeholder resolutions" ON "public"."placeholder_resolutions" FOR INSERT WITH CHECK (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Club owners can insert recategorizations" ON "public"."player_recategorizations" FOR INSERT WITH CHECK ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))) OR ("recategorized_by" = "auth"."uid"())));



CREATE POLICY "Members can view their own membership" ON "public"."organization_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Organization members can view their organization clubs" ON "public"."organization_clubs" FOR SELECT USING (("organizacion_id" IN ( SELECT "organization_members"."organizacion_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."is_active" = true)))));



CREATE POLICY "Organization owners can manage clubs" ON "public"."organization_clubs" USING (("organizacion_id" IN ( SELECT "organization_members"."organizacion_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."member_role" = 'owner'::"text") AND ("organization_members"."is_active" = true)))));



CREATE POLICY "Organization owners can manage members" ON "public"."organization_members" USING (("organizacion_id" IN ( SELECT "om"."organizacion_id"
   FROM "public"."organization_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."member_role" = 'owner'::"text") AND ("om"."is_active" = true)))));



CREATE POLICY "Organization owners can update their organizations" ON "public"."organizaciones" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "organization_members"."organizacion_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."member_role" = 'owner'::"text") AND ("organization_members"."is_active" = true))))) WITH CHECK (("id" IN ( SELECT "organization_members"."organizacion_id"
   FROM "public"."organization_members"
  WHERE (("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."member_role" = 'owner'::"text") AND ("organization_members"."is_active" = true)))));



CREATE POLICY "Public read access for active organizations" ON "public"."organizaciones" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can create their own organization membership" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view audit logs for their tournaments" ON "public"."audit_logs" FOR SELECT USING ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view bracket operations for their tournaments" ON "public"."bracket_operations_log" FOR SELECT USING ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view match results history for their tournaments" ON "public"."match_results_history" FOR SELECT USING (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view placeholder resolutions for their tournaments" ON "public"."placeholder_resolutions" FOR SELECT USING (("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view recategorizations for their tournaments" ON "public"."player_recategorizations" FOR SELECT USING ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."club_id" IN ( SELECT "clubes"."id"
           FROM "public"."clubes"
          WHERE ("clubes"."user_id" = "auth"."uid"()))))) OR ("recategorized_by" = "auth"."uid"())));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_app_managed_delete" ON "public"."audit_logs" FOR DELETE USING (true);



CREATE POLICY "audit_logs_app_managed_update" ON "public"."audit_logs" FOR UPDATE USING (true);



CREATE POLICY "bracket_operations_log_app_managed_delete" ON "public"."bracket_operations_log" FOR DELETE USING (true);



CREATE POLICY "bracket_operations_log_app_managed_update" ON "public"."bracket_operations_log" FOR UPDATE USING (true);



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_public_select" ON "public"."categories" FOR SELECT USING (true);



ALTER TABLE "public"."clubes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clubes_own_data_delete" ON "public"."clubes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "clubes_own_data_insert" ON "public"."clubes" FOR INSERT WITH CHECK (true);



CREATE POLICY "clubes_own_data_update" ON "public"."clubes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "clubes_public_select" ON "public"."clubes" FOR SELECT USING (true);



ALTER TABLE "public"."coach_inquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_inquiries_public_select" ON "public"."coach_inquiries" FOR SELECT USING (true);



ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coaches_public_select" ON "public"."coaches" FOR SELECT USING (true);



ALTER TABLE "public"."couple_availability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "couple_availability_authorized_delete" ON "public"."couple_availability" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "couple_availability_authorized_insert" ON "public"."couple_availability" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."couples" "c"
     JOIN "public"."players" "p1" ON (("c"."player1_id" = "p1"."id")))
     JOIN "public"."players" "p2" ON (("c"."player2_id" = "p2"."id")))
  WHERE (("c"."id" = "couple_availability"."couple_id") AND (("p1"."user_id" = "auth"."uid"()) OR ("p2"."user_id" = "auth"."uid"())))))));



CREATE POLICY "couple_availability_authorized_select" ON "public"."couple_availability" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."couples" "c"
     JOIN "public"."players" "p1" ON (("c"."player1_id" = "p1"."id")))
     JOIN "public"."players" "p2" ON (("c"."player2_id" = "p2"."id")))
  WHERE (("c"."id" = "couple_availability"."couple_id") AND (("p1"."user_id" = "auth"."uid"()) OR ("p2"."user_id" = "auth"."uid"())))))));



CREATE POLICY "couple_availability_authorized_update" ON "public"."couple_availability" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "couple_availability"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."couples" "c"
     JOIN "public"."players" "p1" ON (("c"."player1_id" = "p1"."id")))
     JOIN "public"."players" "p2" ON (("c"."player2_id" = "p2"."id")))
  WHERE (("c"."id" = "couple_availability"."couple_id") AND (("p1"."user_id" = "auth"."uid"()) OR ("p2"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."couples" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "couples_app_managed_insert" ON "public"."couples" FOR INSERT WITH CHECK (true);



CREATE POLICY "couples_app_managed_update" ON "public"."couples" FOR UPDATE USING (true);



CREATE POLICY "couples_club_manage_for_tournaments" ON "public"."couples" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'CLUB'::"public"."ROLE")))));



CREATE POLICY "couples_player_update" ON "public"."couples" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "players"."user_id"
   FROM "public"."players"
  WHERE (("players"."id" = "couples"."player1_id") OR ("players"."id" = "couples"."player2_id")))));



CREATE POLICY "couples_public_select" ON "public"."couples" FOR SELECT USING (true);



ALTER TABLE "public"."dni_conflicts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dni_conflicts_public_select" ON "public"."dni_conflicts" FOR SELECT USING (true);



CREATE POLICY "inscriptions_app_managed_delete" ON "public"."inscriptions" FOR DELETE USING (true);



CREATE POLICY "inscriptions_app_managed_insert" ON "public"."inscriptions" FOR INSERT WITH CHECK (true);



CREATE POLICY "inscriptions_app_managed_update" ON "public"."inscriptions" FOR UPDATE USING (true);



CREATE POLICY "inscriptions_public_select" ON "public"."inscriptions" FOR SELECT USING (true);



ALTER TABLE "public"."match_hierarchy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_hierarchy_app_managed_delete" ON "public"."match_hierarchy" FOR DELETE USING (true);



CREATE POLICY "match_hierarchy_app_managed_insert" ON "public"."match_hierarchy" FOR INSERT WITH CHECK (true);



CREATE POLICY "match_hierarchy_app_managed_update" ON "public"."match_hierarchy" FOR UPDATE USING (true);



CREATE POLICY "match_hierarchy_public_select" ON "public"."match_hierarchy" FOR SELECT USING (true);



ALTER TABLE "public"."match_points_couples" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_points_couples_app_managed_delete" ON "public"."match_points_couples" FOR DELETE USING (true);



CREATE POLICY "match_points_couples_app_managed_insert" ON "public"."match_points_couples" FOR INSERT WITH CHECK (true);



CREATE POLICY "match_points_couples_app_managed_update" ON "public"."match_points_couples" FOR UPDATE USING (true);



CREATE POLICY "match_points_couples_public_select" ON "public"."match_points_couples" FOR SELECT USING (true);



CREATE POLICY "match_results_history_app_managed_delete" ON "public"."match_results_history" FOR DELETE USING (true);



CREATE POLICY "match_results_history_app_managed_update" ON "public"."match_results_history" FOR UPDATE USING (true);



ALTER TABLE "public"."match_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_sets_authorized_delete" ON "public"."match_sets" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ((("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "match_sets_authorized_insert" ON "public"."match_sets" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ((("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "match_sets_authorized_update" ON "public"."match_sets" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ((("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("m"."id" = "match_sets"."match_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "match_sets_public_select" ON "public"."match_sets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("m"."tournament_id" = "t"."id")))
  WHERE ("m"."id" = "match_sets"."match_id"))));



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_club_delete" ON "public"."matches" FOR DELETE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM ("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
  WHERE ("t"."id" = "matches"."tournament_id"))));



CREATE POLICY "matches_club_manage" ON "public"."matches" FOR INSERT WITH CHECK (true);



CREATE POLICY "matches_club_update" ON "public"."matches" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM ("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
  WHERE ("t"."id" = "matches"."tournament_id"))));



CREATE POLICY "matches_public_select" ON "public"."matches" FOR SELECT USING (true);



ALTER TABLE "public"."organizaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."placeholder_resolutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "placeholder_resolutions_app_managed_delete" ON "public"."placeholder_resolutions" FOR DELETE USING (true);



CREATE POLICY "placeholder_resolutions_app_managed_update" ON "public"."placeholder_resolutions" FOR UPDATE USING (true);



ALTER TABLE "public"."player_recategorizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_recategorizations_app_managed_delete" ON "public"."player_recategorizations" FOR DELETE USING (true);



CREATE POLICY "player_recategorizations_app_managed_update" ON "public"."player_recategorizations" FOR UPDATE USING (true);



ALTER TABLE "public"."player_tournament_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_tournament_history_app_managed_delete" ON "public"."player_tournament_history" FOR DELETE USING (true);



CREATE POLICY "player_tournament_history_app_managed_insert" ON "public"."player_tournament_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "player_tournament_history_app_managed_update" ON "public"."player_tournament_history" FOR UPDATE USING (true);



CREATE POLICY "player_tournament_history_public_select" ON "public"."player_tournament_history" FOR SELECT USING (true);



ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "players_app_managed_insert" ON "public"."players" FOR INSERT WITH CHECK (true);



CREATE POLICY "players_app_managed_update" ON "public"."players" FOR UPDATE USING (true);



CREATE POLICY "players_club_update_for_tournaments" ON "public"."players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'CLUB'::"public"."ROLE")))));



CREATE POLICY "players_own_data_delete" ON "public"."players" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "players_own_data_update" ON "public"."players" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "players_public_select" ON "public"."players" FOR SELECT USING (true);



ALTER TABLE "public"."ranking_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ranking_snapshots_app_managed_delete" ON "public"."ranking_snapshots" FOR DELETE USING (true);



CREATE POLICY "ranking_snapshots_app_managed_insert" ON "public"."ranking_snapshots" FOR INSERT WITH CHECK (true);



CREATE POLICY "ranking_snapshots_app_managed_update" ON "public"."ranking_snapshots" FOR UPDATE USING (true);



CREATE POLICY "ranking_snapshots_public_select" ON "public"."ranking_snapshots" FOR SELECT USING (true);



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_app_managed_delete" ON "public"."services" FOR DELETE USING (true);



CREATE POLICY "services_app_managed_insert" ON "public"."services" FOR INSERT WITH CHECK (true);



CREATE POLICY "services_app_managed_update" ON "public"."services" FOR UPDATE USING (true);



ALTER TABLE "public"."services_clubes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_clubes_app_managed_delete" ON "public"."services_clubes" FOR DELETE USING (true);



CREATE POLICY "services_clubes_app_managed_insert" ON "public"."services_clubes" FOR INSERT WITH CHECK (true);



CREATE POLICY "services_clubes_app_managed_update" ON "public"."services_clubes" FOR UPDATE USING (true);



CREATE POLICY "services_clubes_public_select" ON "public"."services_clubes" FOR SELECT USING (true);



CREATE POLICY "services_public_select" ON "public"."services" FOR SELECT USING (true);



ALTER TABLE "public"."tournament_couple_seeds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_couple_seeds_app_managed_insert" ON "public"."tournament_couple_seeds" FOR INSERT WITH CHECK (true);



CREATE POLICY "tournament_couple_seeds_app_managed_update" ON "public"."tournament_couple_seeds" FOR UPDATE USING (true);



CREATE POLICY "tournament_couple_seeds_public_select" ON "public"."tournament_couple_seeds" FOR SELECT USING (true);



ALTER TABLE "public"."tournament_dates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_dates_authorized_delete" ON "public"."tournament_dates" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "tournament_dates_authorized_insert" ON "public"."tournament_dates" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "tournament_dates_authorized_update" ON "public"."tournament_dates" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."tournaments" "t"
     JOIN "public"."clubes" "c" ON (("t"."club_id" = "c"."id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."tournaments" "t"
     JOIN "public"."organization_clubs" "oc" ON (("t"."club_id" = "oc"."club_id")))
     JOIN "public"."organization_members" "om" ON (("oc"."organizacion_id" = "om"."organizacion_id")))
  WHERE (("t"."id" = "tournament_dates"."tournament_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "tournament_dates_public_select" ON "public"."tournament_dates" FOR SELECT USING (true);



ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_club_delete" ON "public"."tournaments" FOR DELETE USING (("auth"."uid"() IN ( SELECT "clubes"."user_id"
   FROM "public"."clubes"
  WHERE ("clubes"."id" = "tournaments"."club_id"))));



CREATE POLICY "tournaments_club_insert" ON "public"."tournaments" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "clubes"."user_id"
   FROM "public"."clubes"
  WHERE ("clubes"."id" = "tournaments"."club_id"))));



CREATE POLICY "tournaments_club_manage" ON "public"."tournaments" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "clubes"."user_id"
   FROM "public"."clubes"
  WHERE ("clubes"."id" = "tournaments"."club_id"))));



CREATE POLICY "tournaments_public_select" ON "public"."tournaments" FOR SELECT USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_on_signup" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "users_own_data_update" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "users_public_select" ON "public"."users" FOR SELECT USING (true);



ALTER TABLE "public"."zone_couples" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zone_couples_club_delete" ON "public"."zone_couples" FOR DELETE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_couples"."zone_id"))));



CREATE POLICY "zone_couples_club_manage" ON "public"."zone_couples" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_couples"."zone_id"))));



CREATE POLICY "zone_couples_club_update" ON "public"."zone_couples" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_couples"."zone_id"))));



CREATE POLICY "zone_couples_public_select" ON "public"."zone_couples" FOR SELECT USING (true);



ALTER TABLE "public"."zone_positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zone_positions_club_delete" ON "public"."zone_positions" FOR DELETE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_positions"."zone_id"))));



CREATE POLICY "zone_positions_club_manage" ON "public"."zone_positions" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_positions"."zone_id"))));



CREATE POLICY "zone_positions_club_update" ON "public"."zone_positions" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM (("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
     JOIN "public"."zones" "z" ON (("z"."tournament_id" = "t"."id")))
  WHERE ("z"."id" = "zone_positions"."zone_id"))));



CREATE POLICY "zone_positions_public_select" ON "public"."zone_positions" FOR SELECT USING (true);



CREATE POLICY "zones_club_delete" ON "public"."zones" FOR DELETE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM ("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
  WHERE ("t"."id" = "zones"."tournament_id"))));



CREATE POLICY "zones_club_manage" ON "public"."zones" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM ("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
  WHERE ("t"."id" = "zones"."tournament_id"))));



CREATE POLICY "zones_club_update" ON "public"."zones" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "c"."user_id"
   FROM ("public"."clubes" "c"
     JOIN "public"."tournaments" "t" ON (("c"."id" = "t"."club_id")))
  WHERE ("t"."id" = "zones"."tournament_id"))));



CREATE POLICY "zones_public_select" ON "public"."zones" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clubes";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."advance_bye_winners_single_level"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_bye_winners_single_level"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_bye_winners_single_level"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_tournament_points"("player_updates" "jsonb"[], "match_points" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_tournament_points"("player_updates" "jsonb"[], "match_points" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_tournament_points"("player_updates" "jsonb"[], "match_points" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."couple_to_empty_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."couple_to_placeholder_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."couple_to_placeholder_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."couple_to_placeholder_swap"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_source_slot" "text", "p_source_couple_id" "uuid", "p_target_match_id" "uuid", "p_target_slot" "text", "p_operation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text", "start_date_param" "date", "end_date_param" "date", "is_qualifying_param" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text", "start_date_param" "date", "end_date_param" "date", "is_qualifying_param" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tournament_fecha"("tournament_uuid" "uuid", "fecha_name" "text", "fecha_description" "text", "start_date_param" "date", "end_date_param" "date", "is_qualifying_param" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_fecha_number"("tournament_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tournament_placeholder_status"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_placeholder_status"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_placeholder_status"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_couple_played_in_zone"("p_couple_id" "uuid", "p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_match_hierarchy"("tournament_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_match_hierarchy"("tournament_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_match_hierarchy"("tournament_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_bracket_byes"("p_tournament_id" "uuid", "p_match_ids" "uuid"[], "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_bracket_byes"("p_tournament_id" "uuid", "p_match_ids" "uuid"[], "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_bracket_byes"("p_tournament_id" "uuid", "p_match_ids" "uuid"[], "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_placeholders_atomic"("p_tournament_id" "uuid", "p_resolutions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_atomic"("p_tournament_id" "uuid", "p_resolutions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_atomic"("p_tournament_id" "uuid", "p_resolutions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_placeholders_seeds_only"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_seeds_only"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_seeds_only"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_placeholders_with_fks"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_with_fks"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_placeholders_with_fks"("p_tournament_id" "uuid", "p_zone_resolutions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."swap_bracket_positions"("p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_source_couple_id" "uuid", "p_target_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."swap_bracket_positions"("p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_source_couple_id" "uuid", "p_target_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."swap_bracket_positions"("p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_source_couple_id" "uuid", "p_target_couple_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."swap_bracket_positions_atomic"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."swap_bracket_positions_atomic"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."swap_bracket_positions_atomic"("p_tournament_id" "uuid", "p_user_id" "uuid", "p_source_match_id" "uuid", "p_target_match_id" "uuid", "p_source_slot" "text", "p_target_slot" "text", "p_operation_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_couple_availability_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_couple_availability_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_couple_availability_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_match_sets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_match_sets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_match_sets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_matches_via_fk"("p_tournament_id" "uuid", "p_seed_id" "uuid", "p_couple_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_matches_via_fk"("p_tournament_id" "uuid", "p_seed_id" "uuid", "p_couple_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_matches_via_fk"("p_tournament_id" "uuid", "p_seed_id" "uuid", "p_couple_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tournament_dates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tournament_dates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tournament_dates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_zone_positions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_zone_positions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_zone_positions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_system_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_system_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_system_change"() TO "service_role";



























GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."backup_matches_20250825" TO "anon";
GRANT ALL ON TABLE "public"."backup_matches_20250825" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_matches_20250825" TO "service_role";



GRANT ALL ON TABLE "public"."backup_tournament_couple_seeds_20250825" TO "anon";
GRANT ALL ON TABLE "public"."backup_tournament_couple_seeds_20250825" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_tournament_couple_seeds_20250825" TO "service_role";



GRANT ALL ON TABLE "public"."backup_tournaments_20250825" TO "anon";
GRANT ALL ON TABLE "public"."backup_tournaments_20250825" TO "authenticated";
GRANT ALL ON TABLE "public"."backup_tournaments_20250825" TO "service_role";



GRANT ALL ON TABLE "public"."bracket_operations_log" TO "anon";
GRANT ALL ON TABLE "public"."bracket_operations_log" TO "authenticated";
GRANT ALL ON TABLE "public"."bracket_operations_log" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."clubes" TO "anon";
GRANT ALL ON TABLE "public"."clubes" TO "authenticated";
GRANT ALL ON TABLE "public"."clubes" TO "service_role";



GRANT ALL ON TABLE "public"."coach_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."coach_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT ALL ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT ALL ON TABLE "public"."couple_availability" TO "anon";
GRANT ALL ON TABLE "public"."couple_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."couple_availability" TO "service_role";



GRANT ALL ON TABLE "public"."couples" TO "anon";
GRANT ALL ON TABLE "public"."couples" TO "authenticated";
GRANT ALL ON TABLE "public"."couples" TO "service_role";



GRANT ALL ON TABLE "public"."dni_conflicts" TO "anon";
GRANT ALL ON TABLE "public"."dni_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."dni_conflicts" TO "service_role";



GRANT ALL ON TABLE "public"."inscriptions" TO "anon";
GRANT ALL ON TABLE "public"."inscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."inscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."match_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."match_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."match_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."match_points_couples" TO "anon";
GRANT ALL ON TABLE "public"."match_points_couples" TO "authenticated";
GRANT ALL ON TABLE "public"."match_points_couples" TO "service_role";



GRANT ALL ON TABLE "public"."match_results_history" TO "anon";
GRANT ALL ON TABLE "public"."match_results_history" TO "authenticated";
GRANT ALL ON TABLE "public"."match_results_history" TO "service_role";



GRANT ALL ON TABLE "public"."match_sets" TO "anon";
GRANT ALL ON TABLE "public"."match_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."match_sets" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."organizaciones" TO "anon";
GRANT ALL ON TABLE "public"."organizaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."organizaciones" TO "service_role";



GRANT ALL ON TABLE "public"."organization_clubs" TO "anon";
GRANT ALL ON TABLE "public"."organization_clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_clubs" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."placeholder_resolutions" TO "anon";
GRANT ALL ON TABLE "public"."placeholder_resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."placeholder_resolutions" TO "service_role";



GRANT ALL ON TABLE "public"."player_recategorizations" TO "anon";
GRANT ALL ON TABLE "public"."player_recategorizations" TO "authenticated";
GRANT ALL ON TABLE "public"."player_recategorizations" TO "service_role";



GRANT ALL ON TABLE "public"."player_tournament_history" TO "anon";
GRANT ALL ON TABLE "public"."player_tournament_history" TO "authenticated";
GRANT ALL ON TABLE "public"."player_tournament_history" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."ranking_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."ranking_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."ranking_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."services_clubes" TO "anon";
GRANT ALL ON TABLE "public"."services_clubes" TO "authenticated";
GRANT ALL ON TABLE "public"."services_clubes" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_couple_seeds" TO "anon";
GRANT ALL ON TABLE "public"."tournament_couple_seeds" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_couple_seeds" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_dates" TO "anon";
GRANT ALL ON TABLE "public"."tournament_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_dates" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."user_details_v" TO "anon";
GRANT ALL ON TABLE "public"."user_details_v" TO "authenticated";
GRANT ALL ON TABLE "public"."user_details_v" TO "service_role";



GRANT ALL ON TABLE "public"."v_placeholder_consistency" TO "anon";
GRANT ALL ON TABLE "public"."v_placeholder_consistency" TO "authenticated";
GRANT ALL ON TABLE "public"."v_placeholder_consistency" TO "service_role";



GRANT ALL ON TABLE "public"."zone_couples" TO "anon";
GRANT ALL ON TABLE "public"."zone_couples" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_couples" TO "service_role";



GRANT ALL ON TABLE "public"."zone_positions" TO "anon";
GRANT ALL ON TABLE "public"."zone_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_positions" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
