import { NextRequest, NextResponse } from 'next/server'
import { generatePlaceholderBracketAction } from '../actions'
import { validatePlaceholderBracketGeneration } from '@/lib/services/bracket-generation-validation'

/**
 * POST /api/tournaments/[id]/generate-placeholder-bracket
 * 
 * Genera bracket con placeholders para un torneo específico.
 * Este endpoint actúa como bridge entre Client Components y Server Actions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 })
    }

    console.log(`[API] Starting placeholder bracket generation for tournament: ${tournamentId}`)

    // Llamar al Server Action desde el API Route
    const result = await generatePlaceholderBracketAction(tournamentId)
    
    const resultData = 'data' in result ? result.data : undefined

    console.log(`[API] Placeholder bracket generation result:`, {
      success: result.success,
      definitiveSeeds: resultData?.definitiveSeeds,
      placeholderSeeds: resultData?.placeholderSeeds,
      totalMatches: resultData?.totalMatches
    })
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('[API] Error in generate-placeholder-bracket route:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate placeholder bracket'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 })
    }

    const validation = await validatePlaceholderBracketGeneration(tournamentId)

    return NextResponse.json(validation)
  } catch (error: any) {
    console.error('[API] Error validating placeholder bracket generation:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to validate placeholder bracket generation'
    }, { status: 500 })
  }
}
