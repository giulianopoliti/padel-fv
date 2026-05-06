/**
 * 🏦 PAYMENT RECORDS SERVICE
 *
 * Gestión de registros de pago para inscripciones de torneos.
 * Los pagos son independientes de la aprobación de inscripciones.
 *
 * Responsabilidades:
 * - Crear registros de pago bajo demanda
 * - Actualizar estado de pago individual
 * - Asegurar consistencia de datos
 */

import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentRecord {
  inscription_id: string;
  player_id: string;
  has_paid: boolean;
  paid_at: string | null;
}

export interface CreatePaymentRecordsParams {
  inscriptionId: string;
  coupleId: string;
  supabase?: SupabaseClient;
}

export interface UpdatePaymentStatusParams {
  inscriptionId: string;
  playerId: string;
  hasPaid: boolean;
  supabase?: SupabaseClient;
}

/**
 * Asegurar que existen registros de pago para una inscripción
 *
 * Se ejecuta "bajo demanda" (lazy creation):
 * - Al intentar marcar un pago por primera vez
 * - Al cargar datos de pago en el frontend
 * - No se ejecuta automáticamente al aprobar inscripción
 *
 * IMPORTANTE: Solo crea registros que NO existen, nunca modifica existentes
 */
export async function ensurePaymentRecords(
  params: CreatePaymentRecordsParams
): Promise<{ success: boolean; error?: string; created?: number }> {
  const { inscriptionId, coupleId, supabase: clientSupabase } = params;

  try {
    const supabase = clientSupabase || await createClient();

    // Obtener IDs de jugadores de la pareja
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('player1_id, player2_id')
      .eq('id', coupleId)
      .single();

    if (coupleError || !couple) {
      return {
        success: false,
        error: `Pareja no encontrada: ${coupleError?.message || 'Unknown'}`
      };
    }

    const playerIds = [couple.player1_id, couple.player2_id].filter(Boolean) as string[];
    
    if (playerIds.length === 0) {
      return {
        success: false,
        error: 'La pareja no tiene jugadores válidos'
      };
    }

    // Verificar qué registros ya existen
    const { data: existingRecords, error: fetchError } = await supabase
      .from('inscription_payments')
      .select('player_id')
      .eq('inscription_id', inscriptionId)
      .in('player_id', playerIds);

    if (fetchError) {
      console.error('[ensurePaymentRecords] Error fetching existing:', fetchError);
      return {
        success: false,
        error: `Error al verificar registros: ${fetchError.message}`
      };
    }

    // Determinar qué jugadores necesitan registro nuevo
    const existingPlayerIds = new Set((existingRecords || []).map(r => r.player_id));
    const missingPlayerIds = playerIds.filter(id => !existingPlayerIds.has(id));

    // Solo crear registros para jugadores que NO tienen registro
    if (missingPlayerIds.length > 0) {
      const newRecords = missingPlayerIds.map(playerId => ({
        inscription_id: inscriptionId,
        player_id: playerId,
        has_paid: false
      }));

      const { error: insertError } = await supabase
        .from('inscription_payments')
        .insert(newRecords);

      if (insertError) {
        console.error('[ensurePaymentRecords] Error inserting:', insertError);
        return {
          success: false,
          error: `Error al crear registros: ${insertError.message}`
        };
      }
    }

    return {
      success: true,
      created: missingPlayerIds.length
    };

  } catch (error) {
    console.error('[ensurePaymentRecords] Error inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado'
    };
  }
}

/**
 * Actualizar estado de pago de un jugador
 *
 * Esta función:
 * 1. Asegura que existan registros de pago (lazy creation)
 * 2. Actualiza el estado del jugador específico
 * 3. Registra timestamp si se marca como pagado
 */
export async function updatePaymentStatus(
  params: UpdatePaymentStatusParams
): Promise<{ success: boolean; error?: string }> {
  const { inscriptionId, playerId, hasPaid, supabase: clientSupabase } = params;

  try {
    const supabase = clientSupabase || await createClient();

    // 1. Primero, asegurar que existen registros de pago
    // Necesitamos el couple_id para esto
    const { data: inscription, error: inscriptionError } = await supabase
      .from('inscriptions')
      .select('couple_id')
      .eq('id', inscriptionId)
      .single();

    if (inscriptionError || !inscription?.couple_id) {
      return {
        success: false,
        error: 'Inscripción no encontrada o no tiene pareja asociada'
      };
    }

    // 2. Asegurar que existen los registros (idempotente)
    const ensureResult = await ensurePaymentRecords({
      inscriptionId,
      coupleId: inscription.couple_id,
      supabase
    });

    if (!ensureResult.success) {
      return ensureResult;
    }

    // 3. Actualizar el estado de pago del jugador específico
    const updateData: {
      has_paid: boolean;
      paid_at: string | null;
    } = {
      has_paid: hasPaid,
      paid_at: hasPaid ? new Date().toISOString() : null
    };

    const { error: updateError } = await supabase
      .from('inscription_payments')
      .update(updateData)
      .eq('inscription_id', inscriptionId)
      .eq('player_id', playerId);

    if (updateError) {
      console.error('[updatePaymentStatus] Error:', updateError);
      return {
        success: false,
        error: `Error al actualizar pago: ${updateError.message}`
      };
    }

    console.log(`[updatePaymentStatus] ✅ Pago actualizado: inscripción=${inscriptionId}, jugador=${playerId}, pagado=${hasPaid}`);

    return { success: true };

  } catch (error) {
    console.error('[updatePaymentStatus] Error inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado'
    };
  }
}

/**
 * Crear registros de pago para múltiples inscripciones
 * Útil para migraciones o bulk operations
 */
export async function ensurePaymentRecordsBulk(
  inscriptions: Array<{ id: string; couple_id: string }>
): Promise<{
  success: boolean;
  processed: number;
  errors: Array<{ inscriptionId: string; error: string }>
}> {
  const errors: Array<{ inscriptionId: string; error: string }> = [];
  let processed = 0;

  for (const inscription of inscriptions) {
    const result = await ensurePaymentRecords({
      inscriptionId: inscription.id,
      coupleId: inscription.couple_id
    });

    if (result.success) {
      processed++;
    } else {
      errors.push({
        inscriptionId: inscription.id,
        error: result.error || 'Unknown error'
      });
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors
  };
}
