import { NextRequest, NextResponse } from 'next/server'
import { generateSerpentineBracketAction } from '../actions'

/**
 * API route handler for serpentine bracket generation
 * 
 * POST /api/tournaments/[id]/serpentine-bracket
 * - Generates a serpentine bracket ensuring 1A and 1B can only meet in finals
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id
    
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    console.log(`[POST /serpentine-bracket] 🐍 Generating serpentine bracket for tournament: ${tournamentId}`)

    // Call the serpentine bracket generation action
    const result = await generateSerpentineBracketAction(tournamentId)

    if (result.success) {
      console.log(`[POST /serpentine-bracket] ✅ Success: ${result.message}`)
      return NextResponse.json(result)
    } else {
      console.error(`[POST /serpentine-bracket] ❌ Error: ${result.error}`)
      return NextResponse.json(result, { status: 400 })
    }

  } catch (error: any) {
    console.error('[POST /serpentine-bracket] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error generating serpentine bracket' 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    { 
      message: 'Serpentine bracket generation endpoint',
      tournament_id: params.id,
      available_methods: ['POST'],
      description: 'Use POST to generate a serpentine bracket where 1A and 1B can only meet in finals'
    }
  )
}