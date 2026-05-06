import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

/**
 * Tipos de BYE detectados por el endpoint
 */
type ByeType = 'STRUCTURAL_BYE' | 'PLACEHOLDER_WAITING' | 'NOT_BYE' | 'ALREADY_FINISHED' | 'NOT_FIRST_INSTANCE'

interface ProcessByeStrictResponse {
  success: boolean
  processed?: boolean
  winner?: string
  message?: string
  error?: string
  byeType?: ByeType
  debug?: {
    couple1_id: string | null
    couple2_id: string | null
    tournament_couple_seed1_id: string | null
    tournament_couple_seed2_id: string | null
    status: string
    isFirstInstance?: boolean
    hasParentMatch?: boolean
    hasChildMatches?: boolean
  }
}

type DebugInfo = NonNullable<ProcessByeStrictResponse['debug']>

/**
 * PROCESS-BYE-STRICT Endpoint
 *
 * Este endpoint es más estricto que el process-bye regular porque verifica
 * que el casillero vacío sea completamente NULL (no placeholder esperando resolución)
 * Y que el match sea de PRIMERA INSTANCIA (DEBE tener padre en match_hierarchy).
 *
 * Validaciones:
 * 1. Match debe ser de PRIMERA INSTANCIA (DEBE tener padre en match_hierarchy)
 *    - Las primeras rondas (4TOS, 8VOS, etc.) sí tienen padre (avanzan a otra ronda)
 *    - La FINAL no tiene padre (no avanza) y no debe procesar BYE
 * 2. Casillero vacío debe ser completamente NULL (no placeholder)
 * 3. Match debe estar PENDING (no FINISHED)
 * 4. CASO A: couple1_id + tournament_couple_seed1_id existen, couple2_id + tournament_couple_seed2_id son NULL
 * 5. CASO B: couple2_id + tournament_couple_seed2_id existen, couple1_id + tournament_couple_seed1_id son NULL
 *
 * Rechaza:
 * - Matches con placeholders esperando resolución
 * - Matches sin padre en la jerarquía (no primera instancia, p.ej. FINAL)
 * - Matches ya finalizados
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
): Promise<NextResponse<ProcessByeStrictResponse>> {
  try {
    const tournamentId = params.id
    const matchId = params.matchId

    console.log(`🔍 [PROCESS-BYE-STRICT]  Starting strict BYE validation for match ${matchId}`)

    // 1. CREAR CLIENTE Y VERIFICAR AUTENTICACIÓN
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - User not authenticated'
      }, { status: 401 })
    }

    // 2. VERIFICAR PERMISOS DEL TORNEO
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissionResult.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionResult.reason || 'Insufficient permissions to manage this tournament'
      }, { status: 403 })
    }

    console.log(`✅ [PROCESS-BYE-STRICT] User ${user.id} has permission (${permissionResult.source})`)

    // 3. OBTENER INFORMACIÓN DEL MATCH CON COUPLE_IDs Y TOURNAMENT_COUPLE_SEED_IDs
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        tournament_id,
        status,
        winner_id,
        round,
        order_in_round,
        couple1_id,
        couple2_id,
        tournament_couple_seed1_id,
        tournament_couple_seed2_id
      `)
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !matchData) {
      console.error(`❌ [PROCESS-BYE-STRICT] Match not found:`, matchError)
      return NextResponse.json({
        success: false,
        error: 'Match not found in this tournament'
      }, { status: 404 })
    }

    // Debug info (será actualizado con isFirstInstance)
    let debugInfo: DebugInfo = {
      couple1_id: matchData.couple1_id,
      couple2_id: matchData.couple2_id,
      tournament_couple_seed1_id: matchData.tournament_couple_seed1_id,
      tournament_couple_seed2_id: matchData.tournament_couple_seed2_id,
      status: matchData.status,
      isFirstInstance: false,
      hasParentMatch: false,
      hasChildMatches: false
    }

    console.log(`📊 [PROCESS-BYE-STRICT] Match data:`, debugInfo)

    // 4. VERIFICAR QUE SEA PARTIDO DE PRIMERA INSTANCIA
    // Un match es de primera instancia si:
    //  a) APARECE como child_match_id en match_hierarchy (tiene padre)
    //  b) NO APARECE como parent_match_id (no es padre de nadie)
    const { data: hierarchyCheck, error: hierarchyCheckError } = await supabase
      .from('match_hierarchy')
      .select('child_match_id, parent_match_id')
      .eq('child_match_id', matchId)
      .eq('tournament_id', tournamentId)
      .maybeSingle()

    if (hierarchyCheckError) {
      console.error(`❌ [PROCESS-BYE-STRICT] Error checking match hierarchy:`, hierarchyCheckError)
      return NextResponse.json({
        success: false,
        error: `Error checking match hierarchy: ${hierarchyCheckError.message}`
      }, { status: 500 })
    }

    if (!hierarchyCheck) {
      // El match NO tiene padre → NO es de primera instancia (probable FINAL)
      console.log(`❌ [PROCESS-BYE-STRICT] Match is NOT first instance - no parent match found (likely final round)`) 

      debugInfo = {
        ...debugInfo,
        isFirstInstance: false,
        hasParentMatch: false,
        hasChildMatches: false
      }

      return NextResponse.json({
        success: false,
        error: 'Cannot process BYE - match is not first instance (no parent match in bracket hierarchy)',
        byeType: 'NOT_FIRST_INSTANCE',
        debug: debugInfo
      }, { status: 400 })
    }

    // 4b. Verificar que NO tenga hijos (no debe ser padre de otro match)
    const { data: childrenCheck, error: childrenCheckError } = await supabase
      .from('match_hierarchy')
      .select('parent_match_id')
      .eq('parent_match_id', matchId)
      .eq('tournament_id', tournamentId)
      .limit(1)
      .maybeSingle()

    if (childrenCheckError) {
      console.error(`❌ [PROCESS-BYE-STRICT] Error checking children in match hierarchy:`, childrenCheckError)
      return NextResponse.json({
        success: false,
        error: `Error checking children in match hierarchy: ${childrenCheckError.message}`
      }, { status: 500 })
    }

    if (childrenCheck) {
      // Tiene hijos → NO es primera instancia
      console.log(`❌ [PROCESS-BYE-STRICT] Match is NOT first instance - it is a parent of other match(es)`) 

      debugInfo = {
        ...debugInfo,
        isFirstInstance: false,
        hasParentMatch: true,
        hasChildMatches: true
      }

      return NextResponse.json({
        success: false,
        error: 'Cannot process BYE - match is not first instance (it is a parent of other matches)',
        byeType: 'NOT_FIRST_INSTANCE',
        debug: debugInfo
      }, { status: 400 })
    }

    // Tiene padre y no tiene hijos → es primera instancia
    debugInfo = {
      ...debugInfo,
      isFirstInstance: true,
      hasParentMatch: true,
      hasChildMatches: false
    }

    console.log(`✅ [PROCESS-BYE-STRICT] Match is first instance (has parent: ${hierarchyCheck.parent_match_id}) - can process BYE if structurally valid`)

    // 5. VERIFICAR SI YA ESTÁ FINALIZADO
    if (matchData.status === 'FINISHED') {
      return NextResponse.json({
        success: false,
        error: 'Match is already finished',
        byeType: 'ALREADY_FINISHED',
        debug: debugInfo
      }, { status: 400 })
    }

    // 6. VALIDACIÓN ESTRICTA DEL BYE ESTRUCTURAL
    const hasCouple1 = matchData.couple1_id !== null
    const hasCouple2 = matchData.couple2_id !== null
    const hasSeed1 = matchData.tournament_couple_seed1_id !== null
    const hasSeed2 = matchData.tournament_couple_seed2_id !== null

    console.log(`🔎 [PROCESS-BYE-STRICT] Validation flags:`, {
      hasCouple1,
      hasCouple2,
      hasSeed1,
      hasSeed2
    })

    // 7. DETERMINAR TIPO DE MATCH Y BYE
    let byeType: ByeType
    let winner: string | null = null

    // CASO A: couple1 tiene BYE estructural verdadero
    if (hasCouple1 && hasSeed1 && !hasCouple2 && !hasSeed2) {
      byeType = 'STRUCTURAL_BYE'
      winner = matchData.couple1_id
      console.log(`✅ [PROCESS-BYE-STRICT] STRUCTURAL_BYE detected - couple1 advances (${winner})`)
    }
    // CASO B: couple2 tiene BYE estructural verdadero
    else if (hasCouple2 && hasSeed2 && !hasCouple1 && !hasSeed1) {
      byeType = 'STRUCTURAL_BYE'
      winner = matchData.couple2_id
      console.log(`✅ [PROCESS-BYE-STRICT] STRUCTURAL_BYE detected - couple2 advances (${winner})`)
    }
    // CASO RECHAZADO 1: Placeholder esperando resolución
    // Esto sucede cuando un lado tiene seed pero no couple (placeholder aún no resuelto)
    else if (
      (hasCouple1 && hasSeed1 && !hasCouple2 && hasSeed2) ||
      (hasCouple2 && hasSeed2 && !hasCouple1 && hasSeed1)
    ) {
      byeType = 'PLACEHOLDER_WAITING'
      console.log(`❌ [PROCESS-BYE-STRICT] PLACEHOLDER_WAITING detected - not a structural BYE`)
      return NextResponse.json({
        success: false,
        error: 'Match has placeholder waiting for resolution - not a structural BYE',
        byeType,
        debug: debugInfo
      }, { status: 400 })
    }
    // CASO RECHAZADO 2: No es BYE (ambos presentes o ambos ausentes)
    else {
      byeType = 'NOT_BYE'
      console.log(`❌ [PROCESS-BYE-STRICT] NOT_BYE detected - both couples present or both absent`)
      return NextResponse.json({
        success: false,
        error: 'Match is not a structural BYE (both couples present or both absent)',
        byeType,
        debug: debugInfo
      }, { status: 400 })
    }

    // 8. PROCESAR BYE ESTRUCTURAL VERDADERO
    if (byeType === 'STRUCTURAL_BYE' && winner) {
      console.log(`🏆 [PROCESS-BYE-STRICT] Processing structural BYE: winner ${winner}`)

      // 8a. Marcar match como FINISHED con winner
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          winner_id: winner,
          status: 'FINISHED'
        })
        .eq('id', matchId)

      if (updateError) {
        console.error(`❌ [PROCESS-BYE-STRICT] Failed to finish BYE match:`, updateError)
        return NextResponse.json({
          success: false,
          error: `Failed to finish BYE match: ${updateError.message}`
        }, { status: 500 })
      }

      console.log(`✅ [PROCESS-BYE-STRICT] Match marked as FINISHED with winner ${winner}`)

      // 8b. Avanzar ganador usando la lógica existente
      try {
        const { advanceWinnerUsingHierarchy } = await import('@/app/api/tournaments/actions')
        const advanceResult = await advanceWinnerUsingHierarchy(
          supabase,
          tournamentId,
          matchId,
          winner,
          'auto_bye'
        )

        if (advanceResult.success) {
          console.log(`✅ [PROCESS-BYE-STRICT] BYE processed and advanced: ${advanceResult.message}`)
          return NextResponse.json({
            success: true,
            processed: true,
            winner,
            message: `Structural BYE processed successfully: ${advanceResult.message}`,
            byeType,
            debug: debugInfo
          })
        } else {
          console.warn(`⚠️ [PROCESS-BYE-STRICT] BYE marked finished but advance failed: ${advanceResult.error}`)
          return NextResponse.json({
            success: true,
            processed: true,
            winner,
            message: `BYE processed but advance failed: ${advanceResult.error}`,
            byeType,
            debug: debugInfo
          })
        }
      } catch (advanceError) {
        console.error(`❌ [PROCESS-BYE-STRICT] Error advancing BYE winner:`, advanceError)
        return NextResponse.json({
          success: true,
          processed: true,
          winner,
          message: 'BYE processed but advance failed due to system error',
          byeType,
          debug: debugInfo
        })
      }
    }

    // 9. Fallback (no debería llegar aquí)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error - BYE type determined but not processed',
      byeType,
      debug: debugInfo
    }, { status: 500 })

  } catch (error) {
    console.error('❌ [PROCESS-BYE-STRICT] Critical error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
