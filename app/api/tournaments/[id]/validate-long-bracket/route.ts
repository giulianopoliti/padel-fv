import { NextRequest, NextResponse } from 'next/server'
import { validateLongTournamentForBracket } from '@/utils/tournament-long-validation'

/**
 * GET /api/tournaments/[id]/validate-long-bracket
 *
 * Validates if a LONG format tournament is ready for bracket generation.
 * Checks that all couples have played exactly 3 zone matches.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json({
        canGenerate: false,
        reason: 'Tournament ID is required'
      }, { status: 400 })
    }

    console.log(`[API] Validating LONG tournament for bracket generation: ${tournamentId}`)

    const validation = await validateLongTournamentForBracket(tournamentId)

    console.log(`[API] Validation result:`, {
      canGenerate: validation.canGenerate,
      totalCouples: validation.details?.totalCouples,
      completedCouples: validation.details?.completedCouples
    })

    return NextResponse.json(validation)

  } catch (error: any) {
    console.error('[API] Error validating LONG tournament:', error)
    return NextResponse.json({
      canGenerate: false,
      reason: `Validation error: ${error.message}`
    }, { status: 500 })
  }
}