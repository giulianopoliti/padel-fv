/**
 * CHANGE MATCH STATUS API ENDPOINT
 *
 * Endpoint conservador para cambiar el estado de matches de forma controlada.
 * Solo permite transiciones seguras hacia PENDING para corregir errores.
 *
 * Transiciones permitidas:
 * - IN_PROGRESS → PENDING
 * - WAITING_OPONENT → PENDING
 *
 * Restricciones de seguridad:
 * - NO permite cambiar matches FINISHED (protege resultados)
 * - NO permite cambiar matches con winner_id (protege BYEs procesados)
 * - Solo owners del torneo pueden realizar cambios
 * - Todas las operaciones se registran en auditoría
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-29
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

// ============================================================================
// TIPOS
// ============================================================================

interface ChangeStatusRequest {
  newStatus: 'PENDING'  // Por ahora solo permitimos volver a PENDING
}

interface ChangeStatusResponse {
  success: boolean
  matchId: string
  previousStatus: string
  newStatus: string
  message?: string
  error?: string
}

// Estados válidos desde los cuales se puede cambiar a PENDING
const VALID_SOURCE_STATUSES = ['IN_PROGRESS', 'WAITING_OPONENT'] as const
type ValidSourceStatus = typeof VALID_SOURCE_STATUSES[number]

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
): Promise<NextResponse<ChangeStatusResponse>> {
  try {
    const tournamentId = params.id
    const matchId = params.matchId
    const body: ChangeStatusRequest = await request.json()

    const { newStatus } = body

    console.log('🔄 [ChangeStatus] Iniciando cambio de estado:', {
      tournamentId,
      matchId,
      requestedStatus: newStatus
    })

    // ============================================================================
    // VALIDACIONES DE INPUT
    // ============================================================================

    // Validar que el nuevo estado es PENDING (único permitido por ahora)
    if (newStatus !== 'PENDING') {
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: '',
        newStatus: '',
        error: 'Solo se permite cambiar a estado PENDING'
      }, { status: 400 })
    }

    // ============================================================================
    // AUTENTICACIÓN Y PERMISOS
    // ============================================================================

    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('❌ [ChangeStatus] Usuario no autenticado')
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: '',
        newStatus: '',
        error: 'No autenticado'
      }, { status: 401 })
    }

    // Verificar permisos de owner
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionResult.hasPermission) {
      console.error('❌ [ChangeStatus] Usuario sin permisos:', {
        userId: user.id,
        reason: permissionResult.reason
      })
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: '',
        newStatus: '',
        error: permissionResult.reason || 'Permisos insuficientes'
      }, { status: 403 })
    }

    // ============================================================================
    // OBTENER MATCH Y VALIDAR ESTADO ACTUAL
    // ============================================================================

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        winner_id,
        couple1_id,
        couple2_id,
        round,
        order_in_round,
        court,
        result_couple1,
        result_couple2
      `)
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !match) {
      console.error('❌ [ChangeStatus] Match no encontrado:', matchError)
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: '',
        newStatus: '',
        error: 'Match no encontrado'
      }, { status: 404 })
    }

    const currentStatus = match.status
    console.log('📊 [ChangeStatus] Estado actual del match:', {
      matchId,
      currentStatus,
      hasWinner: !!match.winner_id,
      hasResults: !!(match.result_couple1 || match.result_couple2)
    })

    // ============================================================================
    // VALIDACIONES DE SEGURIDAD
    // ============================================================================

    // 1. NO permitir cambio si el match tiene winner_id (protege BYEs procesados)
    if (match.winner_id) {
      console.error('❌ [ChangeStatus] Match tiene winner_id - operación bloqueada')
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: currentStatus,
        newStatus: '',
        error: 'No se puede cambiar el estado de un match con ganador asignado. Desprocese el BYE primero si es necesario.'
      }, { status: 400 })
    }

    // 2. NO permitir cambio desde FINISHED (protege resultados cargados)
    if (currentStatus === 'FINISHED') {
      console.error('❌ [ChangeStatus] Match está FINISHED - operación bloqueada')
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: currentStatus,
        newStatus: '',
        error: 'No se puede cambiar el estado de un match finalizado con resultados cargados'
      }, { status: 400 })
    }

    // 3. Validar que el estado actual permite transición a PENDING
    if (!VALID_SOURCE_STATUSES.includes(currentStatus as ValidSourceStatus)) {
      console.error('❌ [ChangeStatus] Estado actual no válido para cambio:', currentStatus)
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: currentStatus,
        newStatus: '',
        error: `No se puede cambiar desde estado ${currentStatus}. Solo se permite desde IN_PROGRESS o WAITING_OPONENT`
      }, { status: 400 })
    }

    // 4. Si ya está en PENDING, no hacer nada
    if (currentStatus === 'PENDING') {
      console.log('ℹ️ [ChangeStatus] Match ya está en PENDING - no se requiere cambio')
      return NextResponse.json({
        success: true,
        matchId,
        previousStatus: currentStatus,
        newStatus: 'PENDING',
        message: 'El match ya está en estado PENDING'
      })
    }

    // ============================================================================
    // EJECUTAR CAMBIO DE ESTADO
    // ============================================================================

    console.log('✅ [ChangeStatus] Validaciones completadas - ejecutando cambio')

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: 'PENDING'
      })
      .eq('id', matchId)

    if (updateError) {
      console.error('❌ [ChangeStatus] Error al actualizar estado:', updateError)
      return NextResponse.json({
        success: false,
        matchId,
        previousStatus: currentStatus,
        newStatus: '',
        error: 'Error al actualizar el estado del match'
      }, { status: 500 })
    }

    // ============================================================================
    // REGISTRAR AUDITORÍA
    // ============================================================================

    // Registrar en historial de resultados
    await supabase
      .from('match_results_history')
      .insert({
        match_id: matchId,
        tournament_id: tournamentId,
        user_id: user.id,
        operation_type: 'CHANGE_STATUS',
        result_data: {
          operation: 'change_status',
          from: currentStatus,
          to: 'PENDING',
          timestamp: new Date().toISOString()
        },
        previous_status: currentStatus,
        new_status: 'PENDING',
        operation_metadata: {
          round: match.round,
          order: match.order_in_round,
          court: match.court,
          had_winner: !!match.winner_id
        }
      })

    // Registrar en log de operaciones de bracket
    await supabase
      .from('bracket_operations_log')
      .insert({
        tournament_id: tournamentId,
        operation_type: 'CHANGE_STATUS',
        source_match_id: matchId,
        user_id: user.id,
        operation_metadata: {
          previous_status: currentStatus,
          new_status: 'PENDING',
          timestamp: new Date().toISOString()
        }
      })

    console.log('✅ [ChangeStatus] Estado cambiado exitosamente:', {
      matchId,
      from: currentStatus,
      to: 'PENDING'
    })

    // ============================================================================
    // RESPUESTA EXITOSA
    // ============================================================================

    return NextResponse.json({
      success: true,
      matchId,
      previousStatus: currentStatus,
      newStatus: 'PENDING',
      message: `Estado cambiado de ${currentStatus} a PENDING correctamente`
    })

  } catch (error) {
    console.error('❌ [ChangeStatus] Error crítico:', error)
    return NextResponse.json({
      success: false,
      matchId: params.matchId,
      previousStatus: '',
      newStatus: '',
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}
