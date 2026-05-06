import { NextRequest, NextResponse } from 'next/server'
import { generateTournamentSeeding } from '@/utils/bracket-seeding-algorithm'
import { createClient } from '@/utils/supabase/server'

/**
 * API endpoint para generar seeding usando el nuevo algoritmo perfecto
 * 
 * POST /api/tournaments/[id]/generate-seeding
 * - Genera seeds y bracket_positions basados en zone_positions
 * - Actualiza tournament_couple_seeds table
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

    console.log(`[POST /generate-seeding] 🎯 Generating seeding for tournament: ${tournamentId}`)

    // Crear cliente autenticado
    const supabase = await createClient()
    
    // Usar el algoritmo perfecto con cliente autenticado y auto-detección de estrategia
    const result = await generateTournamentSeeding(tournamentId, supabase)

    console.log(`[POST /generate-seeding] ✅ Success:`, {
      strategy: result.strategy,
      totalCouples: result.totalCouples,
      bracketSize: result.bracketSeeding.P,
      byes: result.bracketSeeding.P - result.totalCouples,
      seedingPreview: result.couplesRanked.slice(0, 8).map((c, i) => ({
        seed: i + 1,
        zone: c.zone_id,
        position: c.position,
        bracket_pos: result.bracketSeeding.position_by_seed[i]
      }))
    })

    return NextResponse.json({
      success: true,
      message: `Seeding generated successfully for ${result.totalCouples} couples`,
      totalCouples: result.totalCouples,
      bracketSize: result.bracketSeeding.P,
      byes: result.bracketSeeding.P - result.totalCouples,
      algorithm: 'serpentine-perfect',
      strategy: result.strategy,
      couplesRanked: result.couplesRanked.map((c, i) => ({
        couple_id: c.couple_id,
        seed: i + 1,
        bracket_position: result.bracketSeeding.position_by_seed[i],
        zone_position: c.position,
        wins: c.wins,
        games_difference: c.games_difference
      }))
    })

  } catch (error: any) {
    console.error('[POST /generate-seeding] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error generating seeding' 
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
      message: 'Tournament seeding generation endpoint',
      tournament_id: tournamentId,
      available_methods: ['POST'],
      description: 'Use POST to generate perfect seeding based on zone results'
    }
  )
}