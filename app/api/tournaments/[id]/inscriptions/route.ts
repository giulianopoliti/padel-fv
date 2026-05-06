import { createClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';
import { checkTournamentAccess } from '@/utils/tournament-permissions';

/**
 * 🎯 API ROUTE: INSCRIPCIONES PARA TORNEOS (AMERICAN Y LONG)
 *
 * Arquitectura híbrida que combina:
 * - SSR inicial (page.tsx)
 * - Real-time updates (este endpoint + SWR)
 * - Escalabilidad futura (webhooks, pagos, etc.)
 *
 * SOPORTA: Torneos tipo AMERICAN y LONG
 * REUTILIZA: Mismas queries y lógica para ambos tipos
 * MEJORA: API separada para SWR y futuras integraciones
 */

interface PaymentInfo {
  player_id: string;
  has_paid: boolean;
  paid_at: string | null;
}

interface InscriptionResponse {
  id: string;
  couple_id: string;
  created_at: string;
  is_pending: boolean;
  payment_proof_status?: 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'APPROVED';
  payment_proof_uploaded_at?: string | null;
  payment_alias_snapshot?: string | null;
  payment_amount_snapshot?: number | null;
  couples: {
    id: string;
    player1_id: string;
    player2_id: string;
    players_player1: PlayerInfo;
    players_player2: PlayerInfo;
  };
  inscription_payments?: PaymentInfo[];
}

interface PlayerInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  score: number | null;
  dni?: string | null;
  phone?: string | null;
}

/**
 * 📖 GET /api/tournaments/[id]/inscriptions
 *
 * Obtiene todas las inscripciones de un torneo (AMERICAN o LONG).
 * REUTILIZA: Query compartida entre ambos tipos de torneos.
 *
 * @param request - Request object de Next.js
 * @param params - Route params con tournament ID
 * @returns Array de inscripciones con datos de jugadores
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    // Verificar que el torneo existe y es tipo válido (LONG o AMERICAN)
    const supabase = await createClient();
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        type,
        status,
        registration_locked,
        bracket_status,
        enable_public_inscriptions,
        enable_payment_checkboxes,
        enable_transfer_proof,
        transfer_alias,
        transfer_amount
      `)
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return Response.json(
        { error: 'Torneo no encontrado' },
        { status: 404 }
      );
    }

    if (!['LONG', 'AMERICAN'].includes(tournament.type)) {
      return Response.json(
        { error: 'Tipo de torneo no válido' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    const accessCheck = await checkTournamentAccess(user?.id || null, tournamentId);
    const canAccessPrivateInscriptions =
      accessCheck.accessLevel === 'FULL_MANAGEMENT' || accessCheck.accessLevel === 'PLAYER_ACTIVE';

    if (!tournament.enable_public_inscriptions && !canAccessPrivateInscriptions) {
      return Response.json(
        { error: 'Las inscripciones públicas de este torneo están deshabilitadas' },
        { status: 403 }
      );
    }

    // ✅ REUTILIZAR: Query compartida entre torneos AMERICAN y LONG
    // Incluir TODAS las inscripciones (pendientes y aprobadas) con is_pending
    // Incluir informacion de pagos (inscription_payments)
    const { data: inscriptions, error: inscriptionsError } = await supabase
      .from('inscriptions')
      .select(`
        id,
        couple_id,
        created_at,
        is_pending,
        payment_proof_status,
        payment_proof_uploaded_at,
        payment_alias_snapshot,
        payment_amount_snapshot,
        couples:couple_id (
          id,
          player1_id,
          player2_id,
          players_player1:player1_id (
            id,
            first_name,
            last_name,
            score,
            dni,
            phone
          ),
          players_player2:player2_id (
            id,
            first_name,
            last_name,
            score,
            dni,
            phone
          )
        ),
        inscription_payments (
          player_id,
          has_paid,
          paid_at
        )
      `)
      .eq('tournament_id', tournamentId)
      .not('couple_id', 'is', null)
      .order('created_at', { ascending: true });

    if (inscriptionsError) {
      console.error('Error fetching inscriptions:', inscriptionsError);
      return Response.json(
        { error: 'Error al cargar inscripciones' },
        { status: 500 }
      );
    }

    // Transformar datos al formato esperado por el frontend
    const formattedInscriptions: InscriptionResponse[] = (inscriptions || [])
      .filter(inscription => inscription.couples) // Filter out null couples
      .map(inscription => ({
        id: inscription.id,
        couple_id: inscription.couple_id,
        created_at: inscription.created_at,
        is_pending: inscription.is_pending ?? false,
        payment_proof_status: inscription.payment_proof_status ?? 'NOT_REQUIRED',
        payment_proof_uploaded_at: inscription.payment_proof_uploaded_at ?? null,
        payment_alias_snapshot: inscription.payment_alias_snapshot ?? null,
        payment_amount_snapshot: inscription.payment_amount_snapshot ?? null,
        couples: {
          id: inscription.couples.id,
          player1_id: inscription.couples.player1_id,
          player2_id: inscription.couples.player2_id,
          players_player1: inscription.couples.players_player1,
          players_player2: inscription.couples.players_player2,
        },
        inscription_payments: inscription.inscription_payments || []
      }));

    // Transform to format expected by useTournamentInscriptions hook (both AMERICAN and LONG)
    const coupleInscriptions = formattedInscriptions.map(inscription => {
      const payments = inscription.inscription_payments || [];
      const player1Payment = payments.find(p => p.player_id === inscription.couples.player1_id);
      const player2Payment = payments.find(p => p.player_id === inscription.couples.player2_id);
      
      return {
        id: inscription.couples.id, // Use couple ID as main ID
        tournament_id: tournamentId,
        player_1_id: inscription.couples.player1_id,
        player_2_id: inscription.couples.player2_id,
        created_at: inscription.created_at,
        player_1_info: inscription.couples.players_player1,
        player_2_info: inscription.couples.players_player2,
        is_pending: inscription.is_pending ?? false,
        payment_proof_status: inscription.payment_proof_status ?? 'NOT_REQUIRED',
        payment_proof_uploaded_at: inscription.payment_proof_uploaded_at ?? null,
        payment_alias_snapshot: inscription.payment_alias_snapshot ?? null,
        payment_amount_snapshot: inscription.payment_amount_snapshot ?? null,
        inscription_id: inscription.id, // ID de la inscripcion para cambiar estado
        // Payment status for each player
        player_1_has_paid: player1Payment?.has_paid ?? false,
        player_2_has_paid: player2Payment?.has_paid ?? false,
      };
    });

    return Response.json({
      coupleInscriptions,
      individualInscriptions: [], // Note: Currently returns empty for both types
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.type,
        status: tournament.status,
        registration_locked: tournament.registration_locked,
        bracket_status: tournament.bracket_status,
        enable_public_inscriptions: tournament.enable_public_inscriptions,
        enable_payment_checkboxes: tournament.enable_payment_checkboxes,
        enable_transfer_proof: tournament.enable_transfer_proof,
        transfer_alias: tournament.transfer_alias,
        transfer_amount: tournament.transfer_amount
      },
      meta: {
        total: coupleInscriptions.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Unexpected error in inscriptions API:', error);
    return Response.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * 📝 POST /api/tournaments/[id]/inscriptions
 *
 * Crea una nueva inscripción de pareja (AMERICAN o LONG).
 * REUTILIZA: registerCoupleForTournament con Strategy Pattern
 * FUTURO: Preparado para integrar pagos (Stripe, MercadoPago, etc.)
 *
 * @param request - Request con datos de inscripción { player1Id, player2Id }
 * @param params - Route params con tournament ID
 * @returns Inscripción creada o error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;
    const body = await request.json();

    const { player1Id, player2Id } = body;

    // Validar parámetros requeridos
    if (!player1Id || !player2Id) {
      return Response.json(
        { error: 'player1Id y player2Id son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el torneo existe y es tipo válido (LONG o AMERICAN)
    const supabase = await createClient();
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, type, status, registration_locked, bracket_status')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return Response.json(
        { error: 'Torneo no encontrado' },
        { status: 404 }
      );
    }

    if (!['LONG', 'AMERICAN'].includes(tournament.type)) {
      return Response.json(
        { error: 'Tipo de torneo no válido' },
        { status: 400 }
      );
    }

    // ✅ REUTILIZAR: Función compartida con Strategy Pattern para ambos tipos
    const { registerCoupleForTournament } = await import('@/app/api/tournaments/actions');
    const result = await registerCoupleForTournament(tournamentId, player1Id, player2Id);

    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Pareja inscrita correctamente',
      inscription: result.inscription,
      meta: {
        tournamentId,
        player1Id,
        player2Id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in POST inscriptions:', error);
    return Response.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * 🗑️ DELETE /api/tournaments/[id]/inscriptions
 *
 * Elimina una inscripción de pareja del torneo (AMERICAN o LONG).
 * REUTILIZA: removeCoupleFromTournament con Strategy Pattern
 *
 * @param request - Request con { coupleId } a eliminar
 * @param params - Route params con tournament ID
 * @returns Resultado de eliminación
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;
    const body = await request.json();

    const { coupleId } = body;

    // Validar parámetros requeridos
    if (!coupleId) {
      return Response.json(
        { error: 'coupleId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el torneo existe y es tipo válido (LONG o AMERICAN)
    const supabase = await createClient();
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, type, status, registration_locked, bracket_status')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return Response.json(
        { error: 'Torneo no encontrado' },
        { status: 404 }
      );
    }

    if (!['LONG', 'AMERICAN'].includes(tournament.type)) {
      return Response.json(
        { error: 'Tipo de torneo no válido' },
        { status: 400 }
      );
    }

    // ✅ REUTILIZAR: Función compartida con Strategy Pattern para ambos tipos
    const { removeCoupleFromTournament } = await import('@/app/api/tournaments/actions');
    const result = await removeCoupleFromTournament(tournamentId, coupleId);

    if (!result.success) {
      return Response.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: result.message,
      meta: {
        tournamentId,
        coupleId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in DELETE inscriptions:', error);
    return Response.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
