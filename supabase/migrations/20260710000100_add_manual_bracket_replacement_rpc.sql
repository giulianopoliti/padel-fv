CREATE OR REPLACE FUNCTION public.replace_bracket_couple_manual(
  p_tournament_id uuid,
  p_user_id uuid,
  p_bracket_key text,
  p_outgoing_couple_id uuid,
  p_incoming_couple_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tournament record;
  v_seed record;
  v_incoming_existing_seed record;
  v_incoming_existing_seed_ids uuid[];
  v_incoming_previous_bracket_key text;
  v_incoming_previous_seed_id uuid;
  v_incoming_belongs boolean;
  v_mismatched_slot_count integer;
  v_locked_match_count integer;
  v_incoming_locked_match_count integer;
  v_incoming_changed_match_count integer := 0;
  v_changed_match_count integer := 0;
  v_match record;
BEGIN
  IF p_outgoing_couple_id = p_incoming_couple_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja entrante debe ser distinta a la saliente'
    );
  END IF;

  SELECT id, type, status
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Torneo no encontrado');
  END IF;

  IF v_tournament.type <> 'LONG' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se permite en torneos LONG');
  END IF;

  IF v_tournament.status <> 'BRACKET_PHASE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El torneo debe estar en fase de llave');
  END IF;

  IF p_bracket_key NOT IN ('MAIN', 'GOLD', 'SILVER') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Llave invalida');
  END IF;

  SELECT *
  INTO v_seed
  FROM tournament_couple_seeds
  WHERE tournament_id = p_tournament_id
    AND bracket_key = p_bracket_key
    AND couple_id = p_outgoing_couple_id
  ORDER BY seed
  LIMIT 1
  FOR UPDATE;

  IF v_seed IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja saliente no esta ubicada en esta llave'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_mismatched_slot_count
  FROM matches
  WHERE tournament_id = p_tournament_id
    AND bracket_key = p_bracket_key
    AND type = 'ELIMINATION'
    AND (
      (couple1_id = p_outgoing_couple_id AND tournament_couple_seed1_id IS DISTINCT FROM v_seed.id)
      OR (couple2_id = p_outgoing_couple_id AND tournament_couple_seed2_id IS DISTINCT FROM v_seed.id)
    );

  IF v_mismatched_slot_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja saliente esta en una posicion de llave desincronizada con su seed. Volve a revisar la llave antes de reemplazar.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM inscriptions
    WHERE tournament_id = p_tournament_id
      AND couple_id = p_incoming_couple_id
      AND COALESCE(es_prueba, false) = false
  )
  INTO v_incoming_belongs;

  IF NOT v_incoming_belongs THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja entrante no pertenece a este torneo'
    );
  END IF;

  SELECT tcs.*
  INTO v_incoming_existing_seed
  FROM tournament_couple_seeds tcs
  WHERE tcs.tournament_id = p_tournament_id
    AND tcs.couple_id = p_incoming_couple_id
  LIMIT 1
  FOR UPDATE;

  SELECT COALESCE(array_agg(tcs.id), ARRAY[]::uuid[])
  INTO v_incoming_existing_seed_ids
  FROM tournament_couple_seeds tcs
  WHERE tcs.tournament_id = p_tournament_id
    AND tcs.couple_id = p_incoming_couple_id;

  IF v_incoming_existing_seed.id IS NOT NULL AND v_incoming_existing_seed.bracket_key = p_bracket_key THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja entrante ya esta en esta llave'
    );
  END IF;

  IF v_incoming_existing_seed.id IS NOT NULL THEN
    v_incoming_previous_bracket_key := v_incoming_existing_seed.bracket_key;
    v_incoming_previous_seed_id := v_incoming_existing_seed.id;
  END IF;

  IF v_incoming_existing_seed.id IS NULL AND EXISTS (
    SELECT 1
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND bracket_key = p_bracket_key
      AND type = 'ELIMINATION'
      AND (couple1_id = p_incoming_couple_id OR couple2_id = p_incoming_couple_id)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La pareja entrante ya esta en esta llave'
    );
  END IF;

  IF v_incoming_existing_seed.id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_incoming_locked_match_count
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND type = 'ELIMINATION'
      AND (
        tournament_couple_seed1_id = ANY(v_incoming_existing_seed_ids)
        OR tournament_couple_seed2_id = ANY(v_incoming_existing_seed_ids)
        OR couple1_id = p_incoming_couple_id
        OR couple2_id = p_incoming_couple_id
      )
      AND (
        status IN ('IN_PROGRESS', 'FINISHED')
        OR winner_id IS NOT NULL
      );

    IF v_incoming_locked_match_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se puede mover la pareja entrante porque ya tiene partido iniciado, finalizado o avance aplicado en otra copa'
      );
    END IF;
  END IF;

  SELECT COUNT(*)
  INTO v_locked_match_count
  FROM matches
  WHERE tournament_id = p_tournament_id
    AND bracket_key = p_bracket_key
    AND type = 'ELIMINATION'
    AND (
      tournament_couple_seed1_id = v_seed.id
      OR tournament_couple_seed2_id = v_seed.id
      OR couple1_id = p_outgoing_couple_id
      OR couple2_id = p_outgoing_couple_id
    )
    AND (
      status IN ('IN_PROGRESS', 'FINISHED')
      OR winner_id IS NOT NULL
    );

  IF v_locked_match_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se puede reemplazar una pareja con partido iniciado, finalizado o avance aplicado'
    );
  END IF;

  UPDATE tournament_couple_seeds
  SET
    couple_id = NULL,
    is_placeholder = true,
    resolved_at = NULL
  WHERE tournament_id = p_tournament_id
    AND couple_id = p_incoming_couple_id
    AND id IS DISTINCT FROM v_seed.id;

  IF v_incoming_existing_seed.id IS NOT NULL THEN
    FOR v_match IN
      SELECT *
      FROM matches
      WHERE tournament_id = p_tournament_id
        AND type = 'ELIMINATION'
        AND (
          tournament_couple_seed1_id = ANY(v_incoming_existing_seed_ids)
          OR tournament_couple_seed2_id = ANY(v_incoming_existing_seed_ids)
          OR couple1_id = p_incoming_couple_id
          OR couple2_id = p_incoming_couple_id
        )
      FOR UPDATE
    LOOP
      UPDATE matches
      SET
        couple1_id = CASE
          WHEN tournament_couple_seed1_id = ANY(v_incoming_existing_seed_ids) OR couple1_id = p_incoming_couple_id
            THEN NULL
          ELSE couple1_id
        END,
        couple2_id = CASE
          WHEN tournament_couple_seed2_id = ANY(v_incoming_existing_seed_ids) OR couple2_id = p_incoming_couple_id
            THEN NULL
          ELSE couple2_id
        END,
        winner_id = NULL,
        status = 'WAITING_OPONENT'
      WHERE id = v_match.id;

      v_incoming_changed_match_count := v_incoming_changed_match_count + 1;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tournament_couple_seeds
    WHERE tournament_id = p_tournament_id
      AND couple_id = p_incoming_couple_id
      AND id IS DISTINCT FROM v_seed.id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo liberar la pareja entrante de su llave anterior antes de asignarla a esta llave'
    );
  END IF;

  UPDATE tournament_couple_seeds
  SET
    couple_id = p_incoming_couple_id,
    is_placeholder = false,
    placeholder_zone_id = NULL,
    placeholder_position = NULL,
    placeholder_label = NULL,
    resolved_at = NOW()
  WHERE id = v_seed.id;

  FOR v_match IN
    SELECT *
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND bracket_key = p_bracket_key
      AND type = 'ELIMINATION'
      AND (
        tournament_couple_seed1_id = v_seed.id
        OR tournament_couple_seed2_id = v_seed.id
        OR couple1_id = p_outgoing_couple_id
        OR couple2_id = p_outgoing_couple_id
      )
    FOR UPDATE
  LOOP
    UPDATE matches
    SET
      couple1_id = CASE
        WHEN tournament_couple_seed1_id = v_seed.id OR couple1_id = p_outgoing_couple_id
          THEN p_incoming_couple_id
        ELSE couple1_id
      END,
      couple2_id = CASE
        WHEN tournament_couple_seed2_id = v_seed.id OR couple2_id = p_outgoing_couple_id
          THEN p_incoming_couple_id
        ELSE couple2_id
      END,
      placeholder_couple1_label = CASE
        WHEN tournament_couple_seed1_id = v_seed.id OR couple1_id = p_outgoing_couple_id
          THEN NULL
        ELSE placeholder_couple1_label
      END,
      placeholder_couple2_label = CASE
        WHEN tournament_couple_seed2_id = v_seed.id OR couple2_id = p_outgoing_couple_id
          THEN NULL
        ELSE placeholder_couple2_label
      END,
      status = CASE
        WHEN status = 'BYE' THEN status
        WHEN (
          CASE
            WHEN tournament_couple_seed1_id = v_seed.id OR couple1_id = p_outgoing_couple_id
              THEN p_incoming_couple_id
            ELSE couple1_id
          END
        ) IS NOT NULL
        AND (
          CASE
            WHEN tournament_couple_seed2_id = v_seed.id OR couple2_id = p_outgoing_couple_id
              THEN p_incoming_couple_id
            ELSE couple2_id
          END
        ) IS NOT NULL
          THEN 'PENDING'
        ELSE 'WAITING_OPONENT'
      END
    WHERE id = v_match.id;

    v_changed_match_count := v_changed_match_count + 1;
  END LOOP;

  INSERT INTO audit_logs (user_id, tournament_id, action, details)
  VALUES (
    p_user_id,
    p_tournament_id,
    'manual_bracket_couple_replacement',
    jsonb_build_object(
      'bracket_key', p_bracket_key,
      'seed_id', v_seed.id,
      'seed', v_seed.seed,
      'bracket_position', v_seed.bracket_position,
      'outgoing_couple_id', p_outgoing_couple_id,
      'incoming_couple_id', p_incoming_couple_id,
      'incoming_previous_bracket_key', v_incoming_previous_bracket_key,
      'incoming_previous_seed_id', v_incoming_previous_seed_id,
      'matches_updated', v_changed_match_count,
      'incoming_previous_matches_updated', v_incoming_changed_match_count,
      'timestamp', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'details', jsonb_build_object(
      'bracket_key', p_bracket_key,
      'seed_id', v_seed.id,
      'seed', v_seed.seed,
      'bracket_position', v_seed.bracket_position,
      'outgoing_couple_id', p_outgoing_couple_id,
      'incoming_couple_id', p_incoming_couple_id,
      'incoming_previous_bracket_key', v_incoming_previous_bracket_key,
      'incoming_previous_seed_id', v_incoming_previous_seed_id,
      'matches_updated', v_changed_match_count,
      'incoming_previous_matches_updated', v_incoming_changed_match_count
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;
