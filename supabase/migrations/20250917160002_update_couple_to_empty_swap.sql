-- Update couple_to_empty_swap - Remove permission validation

CREATE OR REPLACE FUNCTION public.couple_to_empty_swap(
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
  v_source_match record;
  v_target_match record;
  v_source_couple_id uuid;
BEGIN
  -- Lock matches for consistency
  SELECT * INTO v_source_match
  FROM matches
  WHERE id = p_source_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  SELECT * INTO v_target_match
  FROM matches
  WHERE id = p_target_match_id AND tournament_id = p_tournament_id
  FOR UPDATE;

  -- Validate matches exist
  IF v_source_match IS NULL OR v_target_match IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Matches not found or not in tournament',
      'operation_id', p_operation_id
    );
  END IF;

  -- REMOVED: Permission validation (handled by backend API)

  -- Extract source couple ID
  IF p_source_slot = 'couple1_id' THEN
    v_source_couple_id := v_source_match.couple1_id;
  ELSIF p_source_slot = 'couple2_id' THEN
    v_source_couple_id := v_source_match.couple2_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid source slot',
      'operation_id', p_operation_id
    );
  END IF;

  -- Validate source has couple and target is empty
  IF v_source_couple_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source position is already empty',
      'operation_id', p_operation_id
    );
  END IF;

  -- Validate target slot is empty
  IF p_target_slot = 'couple1_id' AND v_target_match.couple1_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target position is not empty',
      'operation_id', p_operation_id
    );
  ELSIF p_target_slot = 'couple2_id' AND v_target_match.couple2_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Target position is not empty',
      'operation_id', p_operation_id
    );
  END IF;

  -- Move couple from source to target
  IF p_source_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = NULL WHERE id = p_source_match_id;
  ELSE
    UPDATE matches SET couple2_id = NULL WHERE id = p_source_match_id;
  END IF;

  IF p_target_slot = 'couple1_id' THEN
    UPDATE matches SET couple1_id = v_source_couple_id WHERE id = p_target_match_id;
  ELSE
    UPDATE matches SET couple2_id = v_source_couple_id WHERE id = p_target_match_id;
  END IF;

  -- Update match statuses based on couple count
  UPDATE matches SET status = CASE
    WHEN couple1_id IS NOT NULL AND couple2_id IS NOT NULL THEN 'PENDING'
    ELSE 'WAITING_OPONENT'
  END WHERE id IN (p_source_match_id, p_target_match_id);

  -- Audit log
  INSERT INTO audit_logs (user_id, tournament_id, action, details)
  VALUES (
    p_user_id,
    p_tournament_id,
    'couple_to_empty_swap',
    jsonb_build_object(
      'operation_id', p_operation_id,
      'source_match_id', p_source_match_id,
      'target_match_id', p_target_match_id,
      'couple_id', v_source_couple_id,
      'timestamp', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'operation_id', p_operation_id,
    'details', jsonb_build_object(
      'moved_couple_id', v_source_couple_id,
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