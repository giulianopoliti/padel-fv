-- Fix Drag & Drop Validations for Bracket Operations
--
-- This migration modifies two RPCs to allow more flexible bracket reorganization:
-- 1. couple_to_placeholder_swap: Remove requirement for placeholder_label (only require tournament_couple_seed_id)
-- 2. swap_bracket_positions_atomic: Allow swaps with matches in WAITING_OPONENT status
--
-- Date: 2025-12-02
-- Author: Claude Code Assistant

-- ============================================================================
-- 1. UPDATE couple_to_placeholder_swap
-- ============================================================================
-- Changes:
-- - Match destino: permitir PENDING además de WAITING_OPONENT
-- - Validación: NO requiere placeholder_label, solo tournament_couple_seed_id
-- - Si placeholder_label es NULL, genera 'TBD' por defecto
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."couple_to_placeholder_swap"(
  "p_tournament_id" "uuid",
  "p_user_id" "uuid",
  "p_source_match_id" "uuid",
  "p_source_slot" "text",
  "p_source_couple_id" "uuid",
  "p_target_match_id" "uuid",
  "p_target_slot" "text",
  "p_operation_id" "text"
) RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_source_seed_id uuid;
  v_target_seed_id uuid;
  v_placeholder_label text;
  v_result jsonb;
BEGIN

  -- VALIDACIONES DE NEGOCIO

  -- 1. Source match debe ser PENDING o WAITING_OPONENT
  IF NOT EXISTS(
    SELECT 1 FROM matches
    WHERE id = p_source_match_id
    AND status IN ('PENDING', 'WAITING_OPONENT')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source match must be PENDING or WAITING_OPONENT status',
      'operation_id', p_operation_id
    );
  END IF;

  -- 2. Target match debe ser WAITING_OPONENT o PENDING (MODIFICADO)
  IF NOT EXISTS(
    SELECT 1 FROM matches
    WHERE id = p_target_match_id
    AND status IN ('WAITING_OPONENT', 'PENDING')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target match must be WAITING_OPONENT or PENDING status',
      'operation_id', p_operation_id
    );
  END IF;

  -- 3. Verificar que source tiene la pareja en el slot correcto
  IF p_source_slot = 'couple1_id' THEN
    IF NOT EXISTS(
      SELECT 1 FROM matches
      WHERE id = p_source_match_id
      AND couple1_id = p_source_couple_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Source couple not found in specified slot',
        'operation_id', p_operation_id
      );
    END IF;
  ELSE
    IF NOT EXISTS(
      SELECT 1 FROM matches
      WHERE id = p_source_match_id
      AND couple2_id = p_source_couple_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Source couple not found in specified slot',
        'operation_id', p_operation_id
      );
    END IF;
  END IF;

  -- 4. Verificar que target slot está vacío y tiene seed (MODIFICADO)
  -- Ya NO requiere placeholder_label obligatorio
  IF p_target_slot = 'couple1_id' THEN
    SELECT
      tournament_couple_seed1_id,
      placeholder_couple1_label  -- Puede ser NULL ahora
    INTO
      v_target_seed_id,
      v_placeholder_label
    FROM matches
    WHERE id = p_target_match_id
      AND couple1_id IS NULL
      AND tournament_couple_seed1_id IS NOT NULL;
      -- REMOVED: AND placeholder_couple1_label IS NOT NULL
  ELSE
    SELECT
      tournament_couple_seed2_id,
      placeholder_couple2_label  -- Puede ser NULL ahora
    INTO
      v_target_seed_id,
      v_placeholder_label
    FROM matches
    WHERE id = p_target_match_id
      AND couple2_id IS NULL
      AND tournament_couple_seed2_id IS NOT NULL;
      -- REMOVED: AND placeholder_couple2_label IS NOT NULL
  END IF;

  -- Validar solo seed_id (MODIFICADO)
  IF v_target_seed_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target slot must have tournament_couple_seed_id',
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'target_match_id', p_target_match_id,
        'target_slot', p_target_slot
      )
    );
  END IF;

  -- REMOVED: No generar placeholder_label default, dejar NULL
  -- El frontend manejará el caso de placeholder sin label
  -- IF v_placeholder_label IS NULL THEN
  --   v_placeholder_label := 'TBD';
  -- END IF;

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
      'error', 'Source match must have tournament_couple_seed_id',
      'operation_id', p_operation_id
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
        'placeholder_moved_to_source', true,
        'placeholder_was_auto_generated', (v_placeholder_label = 'TBD')
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

ALTER FUNCTION "public"."couple_to_placeholder_swap"(
  "p_tournament_id" "uuid",
  "p_user_id" "uuid",
  "p_source_match_id" "uuid",
  "p_source_slot" "text",
  "p_source_couple_id" "uuid",
  "p_target_match_id" "uuid",
  "p_target_slot" "text",
  "p_operation_id" "text"
) OWNER TO "postgres";

-- ============================================================================
-- 2. UPDATE swap_bracket_positions_atomic
-- ============================================================================
-- Changes:
-- - Allow swaps with matches in WAITING_OPONENT status (not just PENDING)
-- - Auto-update match statuses after swap based on couple count
-- ============================================================================

CREATE OR REPLACE FUNCTION public.swap_bracket_positions_atomic(
  p_tournament_id uuid,
  p_user_id uuid,
  p_source_match_id uuid,
  p_target_match_id uuid,
  p_source_slot text,
  p_target_slot text,
  p_operation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_source_match record;
  v_target_match record;
  v_source_couple_id uuid;
  v_target_couple_id uuid;
  v_source_bracket_position smallint;
  v_target_bracket_position smallint;
BEGIN
  -- Lock matches to prevent race conditions
  SELECT * INTO v_source_match
  FROM matches
  WHERE id = p_source_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  SELECT * INTO v_target_match
  FROM matches
  WHERE id = p_target_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  -- Validate matches exist and belong to tournament
  IF v_source_match IS NULL OR v_target_match IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Matches not found or not in tournament',
      'operation_id', p_operation_id
    );
  END IF;

  -- REMOVED: Permission validation (handled by backend API)
  -- Backend API uses checkTournamentPermissions() which supports:
  -- - CLUB owners, ORGANIZADOR members, ADMIN users

  -- Same round requirement
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

  -- Match status (MODIFICADO: permite PENDING o WAITING_OPONENT)
  IF v_source_match.status NOT IN ('PENDING', 'WAITING_OPONENT')
     OR v_target_match.status NOT IN ('PENDING', 'WAITING_OPONENT') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot move couples from/to finished or cancelled matches',
      'operation_id', p_operation_id,
      'details', jsonb_build_object(
        'source_status', v_source_match.status,
        'target_status', v_target_match.status,
        'allowed_statuses', ARRAY['PENDING', 'WAITING_OPONENT']
      )
    );
  END IF;

  -- Extract couple IDs
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

  -- Both positions must have couples
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

  -- Not swapping to same position
  IF p_source_match_id = p_target_match_id AND p_source_slot = p_target_slot THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot move couple to the same position',
      'operation_id', p_operation_id
    );
  END IF;

  -- ATOMIC SWAP OPERATION
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

  -- Sync bracket positions if they exist
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

  -- NUEVO: Actualizar estados según cantidad de parejas (igual que couple_to_empty_swap)
  UPDATE matches SET status = CASE
    WHEN couple1_id IS NOT NULL AND couple2_id IS NOT NULL THEN 'PENDING'::match_status
    ELSE 'WAITING_OPONENT'::match_status
  END WHERE id IN (p_source_match_id, p_target_match_id);

  -- Audit log
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
      'target_match_id', p_target_match_id,
      'statuses_updated', true
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM,
      'operation_id', p_operation_id,
      'error_code', SQLSTATE
    );
END;
$$;
