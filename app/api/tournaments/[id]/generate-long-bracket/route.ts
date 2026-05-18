import { NextRequest, NextResponse } from 'next/server'
import { generatePlaceholderBracketAction } from '../actions'

/**
 * Legacy LONG endpoint kept for compatibility.
 * Internally delegates to canonical placeholder orchestrator.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tournament ID is required',
        },
        { status: 400 }
      )
    }

    const result = await generatePlaceholderBracketAction(tournamentId)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          code: result.code,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      seeding: {
        totalCouples: 'data' in result ? result.data.totalSeeds : 0,
        definitivePositions: 'data' in result ? result.data.definitiveSeeds : 0,
      },
      bracket: {
        matchesCreated: 'data' in result ? result.data.totalMatches : 0,
        autoAdvanceEnabled: true,
      },
      tournamentStatus: 'BRACKET_PHASE',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate LONG bracket',
      },
      { status: 500 }
    )
  }
}
