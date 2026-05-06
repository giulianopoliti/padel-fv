/**
 * 🔍 PAYMENT QUERIES SERVICE
 *
 * Queries para obtener información de pagos.
 * Separado de payment-records.ts para seguir principio de separación de responsabilidades.
 */

import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentStatus {
  player_id: string;
  has_paid: boolean;
  paid_at: string | null;
}

export interface InscriptionPaymentInfo {
  inscription_id: string;
  couple_id: string;
  player1_payment: PaymentStatus | null;
  player2_payment: PaymentStatus | null;
  all_paid: boolean;
  partial_paid: boolean;
}

/**
 * Obtener estado de pagos de una inscripción específica
 */
export async function getInscriptionPayments(
  inscriptionId: string,
  supabase?: SupabaseClient
): Promise<{ success: boolean; data?: InscriptionPaymentInfo; error?: string }> {
  try {
    const client = supabase || await createClient();

    const { data: inscription, error: inscriptionError } = await client
      .from('inscriptions')
      .select(`
        id,
        couple_id,
        couples:couple_id (
          player1_id,
          player2_id
        ),
        inscription_payments (
          player_id,
          has_paid,
          paid_at
        )
      `)
      .eq('id', inscriptionId)
      .single();

    if (inscriptionError || !inscription) {
      return {
        success: false,
        error: 'Inscripción no encontrada'
      };
    }

    const couple = inscription.couples as any;
    const payments = (inscription.inscription_payments || []) as PaymentStatus[];

    const player1Payment = payments.find(p => p.player_id === couple?.player1_id) || null;
    const player2Payment = payments.find(p => p.player_id === couple?.player2_id) || null;

    const allPaid = !!(player1Payment?.has_paid && player2Payment?.has_paid);
    const partialPaid = !!(player1Payment?.has_paid || player2Payment?.has_paid) && !allPaid;

    return {
      success: true,
      data: {
        inscription_id: inscription.id,
        couple_id: inscription.couple_id!,
        player1_payment: player1Payment,
        player2_payment: player2Payment,
        all_paid: allPaid,
        partial_paid: partialPaid
      }
    };

  } catch (error) {
    console.error('[getInscriptionPayments] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado'
    };
  }
}

/**
 * Obtener resumen de pagos de un torneo
 */
export async function getTournamentPaymentsSummary(
  tournamentId: string,
  supabase?: SupabaseClient
): Promise<{
  success: boolean;
  data?: {
    total_inscriptions: number;
    total_players: number;
    players_paid: number;
    players_unpaid: number;
    percentage_paid: number;
  };
  error?: string;
}> {
  try {
    const client = supabase || await createClient();

    // Obtener todas las inscripciones con sus pagos
    const { data: inscriptions, error } = await client
      .from('inscriptions')
      .select(`
        id,
        inscription_payments (
          has_paid
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('is_pending', false)
      .not('couple_id', 'is', null);

    if (error) {
      return { success: false, error: error.message };
    }

    const totalInscriptions = inscriptions?.length || 0;

    let totalPlayers = 0;
    let playersPaid = 0;

    inscriptions?.forEach(inscription => {
      const payments = inscription.inscription_payments || [];
      totalPlayers += payments.length;
      playersPaid += payments.filter((p: any) => p.has_paid).length;
    });

    const playersUnpaid = totalPlayers - playersPaid;
    const percentagePaid = totalPlayers > 0 ? Math.round((playersPaid / totalPlayers) * 100) : 0;

    return {
      success: true,
      data: {
        total_inscriptions: totalInscriptions,
        total_players: totalPlayers,
        players_paid: playersPaid,
        players_unpaid: playersUnpaid,
        percentage_paid: percentagePaid
      }
    };

  } catch (error) {
    console.error('[getTournamentPaymentsSummary] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado'
    };
  }
}
