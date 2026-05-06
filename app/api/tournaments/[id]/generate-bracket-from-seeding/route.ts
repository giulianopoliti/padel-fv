import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateBracketFromSeeding } from '@/utils/bracket-generator-core'

/**
 * API endpoint para generar bracket basado en seeding existente
 * 
 * POST /api/tournaments/[id]/generate-bracket-from-seeding
 * - Lee tournament_couple_seeds
 * - Genera matches eliminatorios usando bracket_position
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    console.log(`[POST /generate-bracket-from-seeding] 🏗️ Generating bracket for tournament: ${tournamentId}`)

    const supabase = await createClient()

    // Usar función utilitaria
    const result = await generateBracketFromSeeding(tournamentId, supabase)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[POST /generate-bracket-from-seeding] ❌ Error generating Hybrid-Serpentino bracket:', error)
    console.error('[POST /generate-bracket-from-seeding] 🔍 Error details:', {
      message: error.message,
      stack: error.stack?.substring(0, 200) + '...'
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error generating Hybrid-Serpentino bracket',
        algorithm: 'hybrid-serpentino',
        step: error.message?.includes('hierarchy') ? 'match_hierarchy_creation' : 'match_creation'
      },
      { status: 500 }
    )
  }
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  return NextResponse.json(
    { 
      message: 'Generate bracket from existing seeding endpoint',
      tournament_id: tournamentId,
      available_methods: ['POST'],
      description: 'Use POST to generate elimination bracket based on tournament_couple_seeds data'
    }
  )
}