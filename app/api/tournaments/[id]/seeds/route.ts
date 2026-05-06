import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * API endpoint para obtener seeds del torneo
 * 
 * GET /api/tournaments/[id]/seeds
 * - Retorna tournament_couple_seeds con información de parejas
 */
export async function GET(
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

    const supabase = await createClient()

    const { data: seeds, error } = await supabase
      .from('tournament_couple_seeds')
      .select(`
        *,
        couples:couple_id (
          id,
          player1:player1_id (
            first_name,
            last_name
          ),
          player2:player2_id (
            first_name,
            last_name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('seed', { ascending: true })

    if (error) {
      throw new Error(`Error fetching seeds: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      seeds: seeds || [],
      count: seeds?.length || 0
    })

  } catch (error: any) {
    console.error('[GET /seeds] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error fetching seeds' 
      },
      { status: 500 }
    )
  }
}