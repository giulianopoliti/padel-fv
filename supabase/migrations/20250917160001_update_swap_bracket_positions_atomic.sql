-- Update swap_bracket_positions_atomic - Remove permission validation

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

  -- Match status (must be PENDING)
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
      'target_match_id', p_target_match_id
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