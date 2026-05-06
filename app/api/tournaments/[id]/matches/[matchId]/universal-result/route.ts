import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { setCompleteEliminationState } from '@/utils/bracket-seeding-algorithm'

// ============================================================================
// TIPOS PARA TORNEO LARGO (BEST OF 3)
// ============================================================================

interface MatchResult {
  format: 'best_of_3'
  sets: Array<{
    couple1_games: number
    couple2_games: number
  }>
  winner_id: string
  match_duration_minutes?: number
  notes?: string
  final_score?: string
  // Campos específicos para sets ganados
  sets_won_couple1?: string  // "2"
  sets_won_couple2?: string  // "1"
}

interface UpdateResultRequest {
  result: MatchResult
  finishMatch?: boolean
}

interface EliminationInfo {
  processed: boolean
  operations: string[]
  error?: string
}

interface UpdateResultResponse {
  success: boolean
  matchId: string
  result: MatchResult
  status: string
  propagated?: any
  elimination?: EliminationInfo
  error?: string
}

// ============================================================================
// ENDPOINT PARA TORNEOS LARGOS (BEST OF 3)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
): Promise<NextResponse<UpdateResultResponse>> {
  try {
    const tournamentId = params.id
    const matchId = params.matchId
    const body: UpdateResultRequest = await request.json()

    const { result, finishMatch = true } = body

    // ✅ VALIDAR QUE ES FORMATO BEST_OF_3
    if (result.format !== 'best_of_3') {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Este endpoint es solo para torneos con formato best_of_3'
      }, { status: 400 })
    }

    // Validar datos del resultado
    if (!result || !result.sets || result.sets.length < 2 || result.sets.length > 3) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Best of 3 requiere entre 2 y 3 sets'
      }, { status: 400 })
    }

    if (!result.winner_id) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Winner ID is required'
      }, { status: 400 })
    }

    // Crear cliente de Supabase
    const supabase = await createClient()

    // Verificar autenticación y permisos (igual que el endpoint original)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Verificar permisos usando la función centralizada
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionResult.hasPermission) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: permissionResult.reason || 'Insufficient permissions'
      }, { status: 403 })
    }

    // Obtener datos del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('club_id, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Tournament not found'
      }, { status: 404 })
    }

    // Obtener el match actual
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, status, court, couple1_id, couple2_id, winner_id,
        round, order_in_round, result_couple1, result_couple2, zone_id
      `)
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !matchData) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Match not found'
      }, { status: 404 })
    }

    // Validar que el match puede recibir resultado
    if (matchData.status === 'WAITING_OPONENT') {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: matchData.status,
        error: 'Cannot add result to match waiting for opponent'
      }, { status: 400 })
    }

    // Validar que el winner_id es una de las parejas del match
    if (result.winner_id !== matchData.couple1_id && result.winner_id !== matchData.couple2_id) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: matchData.status,
        error: 'Winner must be one of the match participants'
      }, { status: 400 })
    }

    // ✅ CALCULAR SETS GANADOS PARA VALIDACIÓN
    const setsWon = result.sets.reduce(
      (acc, set) => {
        if (set.couple1_games > set.couple2_games) {
          acc.couple1++
        } else {
          acc.couple2++
        }
        return acc
      },
      { couple1: 0, couple2: 0 }
    )

    // Validar que el ganador corresponde con los sets ganados
    const calculatedWinner = setsWon.couple1 > setsWon.couple2
      ? matchData.couple1_id
      : matchData.couple2_id

    if (result.winner_id !== calculatedWinner) {
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: `Winner inconsistente: sets ${setsWon.couple1}-${setsWon.couple2} indican ganador ${calculatedWinner}, pero se envió ${result.winner_id}`
      }, { status: 400 })
    }

    // ✅ ACTUALIZAR MATCHES CON SETS GANADOS
    const newStatus = finishMatch ? 'FINISHED' : matchData.status

    const { error: updateMatchError } = await supabase
      .from('matches')
      .update({
        winner_id: result.winner_id,
        status: newStatus,
        result_couple1: setsWon.couple1.toString(),  // "2" (sets ganados)
        result_couple2: setsWon.couple2.toString()   // "1" (sets ganados)
      })
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)

    if (updateMatchError) {
      console.error('Failed to update match:', updateMatchError)
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Failed to update match'
      }, { status: 500 })
    }

    // ✅ INSERTAR DETALLES EN set_matches
    const setsToInsert = result.sets.map((set, index) => {
      const setWinnerId = set.couple1_games > set.couple2_games
        ? matchData.couple1_id
        : matchData.couple2_id

      return {
        match_id: matchId,
        set_number: index + 1,
        couple1_games: set.couple1_games,
        couple2_games: set.couple2_games,
        winner_couple_id: setWinnerId,
        status: 'COMPLETED'
      }
    })

    // Primero eliminar sets existentes (en caso de modificación)
    const { error: deleteError } = await supabase
      .from('set_matches')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      console.error('Failed to delete existing sets:', deleteError)
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Failed to clear existing sets'
      }, { status: 500 })
    }

    // Insertar nuevos sets
    const { error: setsError } = await supabase
      .from('set_matches')
      .insert(setsToInsert)

    if (setsError) {
      console.error('Failed to insert sets:', setsError)
      return NextResponse.json({
        success: false,
        matchId,
        result: {} as MatchResult,
        status: '',
        error: 'Failed to save set details'
      }, { status: 500 })
    }

    // ========================================================================
    // GESTIÓN DE ELIMINACIONES (NUEVA FUNCIONALIDAD)
    // ========================================================================

    let eliminationInfo: EliminationInfo | null = null

    // Solo procesar eliminaciones si el match está finalizado
    if (newStatus === 'FINISHED') {
      console.log(`🚫 [universal-result] Processing elimination status for match ${matchId}`)

      try {
        // Determinar ganador y perdedor
        const loserId = result.winner_id === matchData.couple1_id
          ? matchData.couple2_id
          : matchData.couple1_id

        const eliminationResult = await setCompleteEliminationState(
          tournamentId,
          matchData.id,
          result.winner_id,
          loserId,
          matchData.round as 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL',
          supabase
        )

        eliminationInfo = {
          processed: eliminationResult.success,
          operations: eliminationResult.operations || [],
          error: eliminationResult.error
        }

        if (eliminationResult.success) {
          console.log(`✅ [universal-result] Elimination status updated successfully:`, eliminationResult.operations)
        } else {
          console.warn(`⚠️ [universal-result] Elimination status update failed: ${eliminationResult.error}`)
        }

      } catch (eliminationError: any) {
        console.error('❌ [universal-result] Elimination processing error:', eliminationError)
        eliminationInfo = {
          processed: false,
          operations: [],
          error: eliminationError.message || 'Unknown elimination error'
        }
      }
    } else {
      console.log(`⏸️ [universal-result] Match not finished (${newStatus}), skipping elimination processing`)
      eliminationInfo = {
        processed: false,
        operations: ['skipped-not-finished']
      }
    }

    // ✅ USAR LÓGICA EXISTENTE DE AVANCE (igual que el endpoint original)
    let propagationInfo = null

    if (newStatus === 'FINISHED') {
      try {
        const { advanceWinnerUsingHierarchy } = await import('@/app/api/tournaments/actions')

        const advanceResult = await advanceWinnerUsingHierarchy(
          supabase,
          tournamentId,
          matchId,
          result.winner_id,
          'normal_win'
        )

        if (advanceResult.success) {
          propagationInfo = {
            parentMatch: 'hierarchy-based',
            parentSlot: 0,
            operation: 'initial',
            newWinner: result.winner_id
          }
          console.log(`✅ [universal-result] Avance exitoso: ${advanceResult.message}`)
        } else {
          console.warn(`⚠️ [universal-result] Avance falló: ${advanceResult.error}`)
        }

      } catch (advanceError) {
        console.error('❌ Error en avance automático:', advanceError)
      }
    }

    return NextResponse.json({
      success: true,
      matchId,
      result: {
        ...result,
        final_score: result.sets.map(set => `${set.couple1_games}-${set.couple2_games}`).join(', ')
      },
      status: newStatus,
      propagated: propagationInfo || undefined,
      elimination: eliminationInfo || undefined
    })

  } catch (error) {
    console.error('Universal result error:', error)
    return NextResponse.json({
      success: false,
      matchId: params.matchId,
      result: {} as MatchResult,
      status: '',
      error: 'Internal server error'
    }, { status: 500 })
  }
}