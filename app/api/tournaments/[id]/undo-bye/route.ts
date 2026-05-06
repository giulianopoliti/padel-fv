import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface UndoByeResponse {
  success: boolean
  message?: string
  error?: string
  revertedMatch?: {
    id: string
    round: string
    status: string
  }
}

interface UndoByeRequest {
  matchId: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<UndoByeResponse>> {
  try {
    const tournamentId = params.id
    const body: UndoByeRequest = await request.json()
    const { matchId } = body

    if (!matchId) {
      return NextResponse.json({
        success: false,
        error: 'Match ID is required'
      }, { status: 400 })
    }

    console.log(`🔄 [UNDO-BYE] Starting undo BYE for match ${matchId} in tournament ${tournamentId}`)

    // Crear cliente de Supabase
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - User not authenticated'
      }, { status: 401 })
    }

    // Verificar permisos del torneo
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissionResult.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionResult.reason || 'Insufficient permissions to manage this tournament'
      }, { status: 403 })
    }

    console.log(`✅ [UNDO-BYE] User ${user.id} has permission (${permissionResult.source})`)

    // 1. OBTENER INFORMACIÓN DEL MATCH PADRE (BYE procesado)
    const { data: parentMatch, error: parentMatchError } = await supabase
      .from('matches')
      .select('id, tournament_id, status, winner_id, round, couple1_id, couple2_id')
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (parentMatchError || !parentMatch) {
      console.error(`❌ [UNDO-BYE] Match not found:`, parentMatchError)
      return NextResponse.json({
        success: false,
        error: 'Match not found in this tournament'
      }, { status: 404 })
    }

    // 2. VALIDAR QUE SEA UN BYE PROCESADO
    // Un BYE debe:
    // - Estar FINISHED
    // - Tener winner_id
    // - Tener exactamente una pareja (couple1_id XOR couple2_id)
    if (parentMatch.status !== 'FINISHED') {
      return NextResponse.json({
        success: false,
        error: 'Cannot undo BYE - match is not finished'
      }, { status: 400 })
    }

    if (!parentMatch.winner_id) {
      return NextResponse.json({
        success: false,
        error: 'Cannot undo BYE - match has no winner'
      }, { status: 400 })
    }

    const hasCouple1 = !!parentMatch.couple1_id
    const hasCouple2 = !!parentMatch.couple2_id
    const isBye = (hasCouple1 && !hasCouple2) || (!hasCouple1 && hasCouple2)

    if (!isBye) {
      return NextResponse.json({
        success: false,
        error: 'Cannot undo BYE - match is not a BYE (has both couples or neither)'
      }, { status: 400 })
    }

    console.log(`🎯 [UNDO-BYE] Valid BYE match found: couple1=${hasCouple1}, couple2=${hasCouple2}, winner=${parentMatch.winner_id}`)

    // ✅ IMPORTANTE: Guardar winner_id ANTES de limpiarlo, lo necesitamos para comparar con el match padre (siguiente ronda)
    const savedWinnerId = parentMatch.winner_id

    // 3. BUSCAR MATCH PADRE EN match_hierarchy (el match de la siguiente ronda donde avanzó el ganador)
    // ✅ FIX CRÍTICO: Buscar donde matchId ES HIJO, no donde ES PADRE
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('match_hierarchy')
      .select('parent_match_id, parent_slot, parent_round')
      .eq('child_match_id', matchId)  // ✅ matchId es el hijo (el match que desprocesamos)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (hierarchyError) {
      console.error(`❌ [UNDO-BYE] Error fetching hierarchy:`, hierarchyError)
      return NextResponse.json({
        success: false,
        error: `Error fetching match hierarchy: ${hierarchyError.message}`
      }, { status: 500 })
    }

    // Si no hay jerarquía, es un match final sin padre (no tiene siguiente ronda)
    if (!hierarchyData) {
      console.log(`ℹ️ [UNDO-BYE] No parent match found - this is a final match or first round with no hierarchy`)

      // Solo revertir el match padre
      const { error: revertError } = await supabase
        .from('matches')
        .update({
          status: 'PENDING',
          winner_id: null
        })
        .eq('id', matchId)

      if (revertError) {
        console.error(`❌ [UNDO-BYE] Error reverting parent match:`, revertError)
        return NextResponse.json({
          success: false,
          error: `Failed to revert match: ${revertError.message}`
        }, { status: 500 })
      }

      console.log(`✅ [UNDO-BYE] BYE undone successfully (final match - no children)`)

      return NextResponse.json({
        success: true,
        message: 'BYE undone successfully',
        revertedMatch: {
          id: parentMatch.id,
          round: parentMatch.round,
          status: 'PENDING'
        }
      })
    }

    // 4. OBTENER INFORMACIÓN DEL MATCH PADRE (siguiente ronda)
    const { data: nextRoundMatch, error: nextRoundMatchError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, status, round')
      .eq('id', hierarchyData.parent_match_id)
      .single()

    if (nextRoundMatchError || !nextRoundMatch) {
      console.error(`❌ [UNDO-BYE] Parent match (next round) not found:`, nextRoundMatchError)
      return NextResponse.json({
        success: false,
        error: 'Parent match (next round) not found'
      }, { status: 404 })
    }

    console.log(`🔍 [UNDO-BYE] Parent match (next round) found: ${nextRoundMatch.id} (${nextRoundMatch.round})`)
    console.log(`🔍 [UNDO-BYE] Parent slot: ${hierarchyData.parent_slot}, couple1=${nextRoundMatch.couple1_id}, couple2=${nextRoundMatch.couple2_id}`)
    console.log(`🔍 [UNDO-BYE] Saved winner ID to search: ${savedWinnerId}`)

    // 5. DETERMINAR QUÉ SLOT DEL PADRE (siguiente ronda) CONTIENE LA PAREJA AVANZADA
    // parent_slot indica en qué slot del PADRE debería estar el ganador (1 o 2)
    // Verificamos en qué slot está actualmente la pareja en el match de la siguiente ronda
    const winnerInParentCouple1 = nextRoundMatch.couple1_id === savedWinnerId
    const winnerInParentCouple2 = nextRoundMatch.couple2_id === savedWinnerId

    console.log(`🔍 [UNDO-BYE] Winner detection in parent: inCouple1=${winnerInParentCouple1}, inCouple2=${winnerInParentCouple2}`)

    if (!winnerInParentCouple1 && !winnerInParentCouple2) {
      console.warn(`⚠️ [UNDO-BYE] Winner not found in parent match - may have been already reverted or data inconsistency`)
      console.warn(`⚠️ [UNDO-BYE] Looking for winner: ${savedWinnerId}, found couple1: ${nextRoundMatch.couple1_id}, couple2: ${nextRoundMatch.couple2_id}`)
      // Continuar de todas formas para revertir el match actual
    }

    // 6. REVERTIR MATCHES (ACTUAL Y PADRE DE SIGUIENTE RONDA)

    // 6a. Revertir el match actual (el que desprocesamos): FINISHED -> PENDING, remover winner_id
    const { error: revertCurrentError } = await supabase
      .from('matches')
      .update({
        status: 'PENDING',
        winner_id: null
      })
      .eq('id', matchId)

    if (revertCurrentError) {
      console.error(`❌ [UNDO-BYE] Error reverting current match:`, revertCurrentError)
      return NextResponse.json({
        success: false,
        error: `Failed to revert current match: ${revertCurrentError.message}`
      }, { status: 500 })
    }

    console.log(`✅ [UNDO-BYE] Current match reverted: status=PENDING, winner_id=NULL`)

    // 6b. Revertir el match padre (siguiente ronda): remover la pareja del slot correspondiente
    const parentUpdateData: { couple1_id?: null; couple2_id?: null } = {}

    if (winnerInParentCouple1) {
      parentUpdateData.couple1_id = null
      console.log(`🔧 [UNDO-BYE] Removing couple from parent's couple1_id`)
    } else if (winnerInParentCouple2) {
      parentUpdateData.couple2_id = null
      console.log(`🔧 [UNDO-BYE] Removing couple from parent's couple2_id`)
    }

    // Solo actualizar el padre si hay algo que revertir
    if (Object.keys(parentUpdateData).length > 0) {
      const { error: revertParentError } = await supabase
        .from('matches')
        .update(parentUpdateData)
        .eq('id', nextRoundMatch.id)

      if (revertParentError) {
        console.error(`❌ [UNDO-BYE] Error reverting parent match:`, revertParentError)
        // No fallar completamente, ya revertimos el match actual
        console.warn(`⚠️ [UNDO-BYE] Current match was reverted but parent update failed`)
      } else {
        console.log(`✅ [UNDO-BYE] Parent match reverted: removed couple from slot`)
      }
    }

    console.log(`✅ [UNDO-BYE] BYE undone successfully for match ${matchId}`)

    return NextResponse.json({
      success: true,
      message: 'BYE undone successfully - match reset to PENDING',
      revertedMatch: {
        id: parentMatch.id,
        round: parentMatch.round,
        status: 'PENDING'
      }
    })

  } catch (error) {
    console.error('❌ [UNDO-BYE] Critical error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
