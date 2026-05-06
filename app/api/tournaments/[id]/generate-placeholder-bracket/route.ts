import { NextRequest, NextResponse } from 'next/server'
import { generatePlaceholderBracketAction } from '../actions'

/**
 * POST /api/tournaments/[id]/generate-placeholder-bracket
 * 
 * Genera bracket con placeholders para un torneo específico.
 * Este endpoint actúa como bridge entre Client Components y Server Actions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id

    if (!tournamentId) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 })
    }

    console.log(`[API] Starting placeholder bracket generation for tournament: ${tournamentId}`)

    // Llamar al Server Action desde el API Route
    const result = await generatePlaceholderBracketAction(tournamentId)
    
    console.log(`[API] Placeholder bracket generation result:`, {
      success: result.success,
      definitiveSeeds: result.data?.definitiveSeeds,
      placeholderSeeds: result.data?.placeholderSeeds,
      totalMatches: result.data?.totalMatches
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