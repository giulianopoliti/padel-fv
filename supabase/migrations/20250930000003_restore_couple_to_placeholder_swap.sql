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
