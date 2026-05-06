import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { validateLongTournamentForBracket } from '@/utils/tournament-long-validation'
import { generateTournamentSeeding } from '@/utils/bracket-seeding-algorithm'
import { generateBracketFromSeeding } from '@/utils/bracket-generator-core'

/**
 * POST /api/tournaments/[id]/generate-long-bracket
 *
 * Generates bracket for LONG format tournament after validating that all couples
 * have played exactly 3 zone matches. Forces is_definitive = true temporarily
 * to enable bracket generation using existing infrastructure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const supabase = await createClient()

    console.log(`[GENERATE-LONG-BRACKET] Starting bracket generation for tournament: ${tournamentId}`)

    // 1. Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // 2. Verificar permisos (CLUB owner + ORGANIZADOR)
    const permissions = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissions.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissions.reason || 'Insufficient permissions'
      }, { status: 403 })
    }

    console.log(`[GENERATE-LONG-BRACKET] User ${user.id} has permission as ${permissions.source}`)

    // 3. Validar condición: 3 partidos por pareja
    const validation = await validateLongTournamentForBracket(tournamentId)

    if (!validation.canGenerate) {
      console.log(`[GENERATE-LONG-BRACKET] Validation failed: ${validation.reason}`)
      return NextResponse.json({
        success: false,
        error: validation.reason,
        details: validation.details
      }, { status: 400 })
    }

    console.log(`[GENERATE-LONG-BRACKET] ✅ Validation passed: ${validation.details?.totalCouples} couples ready`)

    // 4. 🔥 FORZAR is_definitive = true TEMPORALMENTE para bracket generation
    console.log(`[GENERATE-LONG-BRACKET] 🎯 Forcing all zone positions as definitive for bracket generation`)

    const { error: definitiveError } = await supabase
      .from('zone_positions')
      .update({ is_definitive: true })
      .eq('tournament_id', tournamentId)

    if (definitiveError) {
      throw new Error(`Failed to mark positions as definitive: ${definitiveError.message}`)
    }

    console.log(`[GENERATE-LONG-BRACKET] ✅ All zone positions marked as definitive`)

    // 5. Generar seeding usando sistema existente (auto-detecta LONG → by-performance)
    console.log(`[GENERATE-LONG-BRACKET] 🎯 Generating tournament seeding...`)

    const seedingResult = await generateTournamentSeeding(tournamentId, supabase)

    console.log(`[GENERATE-LONG-BRACKET] ✅ Seeding generated:`, {
      strategy: seedingResult.strategy,
      totalCouples: seedingResult.totalCouples,
      bracketSize: seedingResult.bracketSeeding.P
    })

    // 6. Generar bracket usando función utilitaria (sin fetch)
    console.log(`[GENERATE-LONG-BRACKET] 🎯 Generating bracket from seeding...`)

    const bracketData = await generateBracketFromSeeding(tournamentId, supabase)

    console.log(`[GENERATE-LONG-BRACKET] ✅ Bracket generated successfully:`, {
      matchesCreated: bracketData.matchesCreated,
      rounds: bracketData.rounds
    })

    // 7. Actualizar estado del torneo
    const { error: statusError } = await supabase
      .from('tournaments')
      .update({
        status: 'BRACKET_PHASE',
        bracket_generated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)

    if (statusError) {
      console.warn('[GENERATE-LONG-BRACKET] Warning: Failed to update tournament status:', statusError)
    }

    return NextResponse.json({
      success: true,
      message: 'LONG format bracket generated successfully',
      validation: validation.details,
      seeding: {
        strategy: seedingResult.strategy,
        totalCouples: seedingResult.totalCouples,
        bracketSize: seedingResult.bracketSeeding.P,
        definitivePositions: seedingResult.totalCouples
      },
      bracket: {
        matchesCreated: bracketData.matchesCreated,
        hierarchyRelations: bracketData.hierarchyRelations,
        rounds: bracketData.rounds,
        autoAdvanceEnabled: bracketData.autoAdvanceEnabled
      },
      tournamentStatus: 'BRACKET_PHASE'
    })

  } catch (error: any) {
    console.error('[GENERATE-LONG-BRACKET] ❌ Error generating bracket:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate LONG bracket',
      details: {
        step: error.message?.includes('seeding') ? 'seeding_generation' :
              error.message?.includes('bracket') ? 'bracket_generation' :
              error.message?.includes('definitive') ? 'marking_definitive' :
              'unknown'
      }
    }, { status: 500 })
  }
}