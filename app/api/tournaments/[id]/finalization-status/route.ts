import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: tournamentId } = await params

    // Obtener estado del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('status, winner_id, end_date')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found'
      }, { status: 404 })
    }

    // Verificar si hay final terminada
    const { data: finalMatch, error: finalError } = await supabase
      .from('matches')
      .select('id, status, winner_id, round')
      .eq('tournament_id', tournamentId)
      .eq('round', 'FINAL')
      .single()

    const finalCompleted = finalMatch && finalMatch.status === 'FINISHED'
    const isFinalized = ['FINISHED_POINTS_PENDING', 'FINISHED_POINTS_CALCULATED'].includes(tournament.status)

    // 🔄 AUTO-CORRECCIÓN: Si la final está terminada pero el torneo no está finalizado
    if (finalCompleted && tournament.status === 'BRACKET_PHASE') {
      console.log(`🔄 [finalization-status] Auto-correcting tournament status from BRACKET_PHASE to FINISHED_POINTS_PENDING`)
      
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ 
          status: 'FINISHED_POINTS_PENDING',
          winner_id: finalMatch.winner_id,
          end_date: new Date().toISOString()
        })
        .eq('id', tournamentId)

      if (!updateError) {
        tournament.status = 'FINISHED_POINTS_PENDING'
        tournament.winner_id = finalMatch.winner_id
        console.log(`✅ [finalization-status] Tournament auto-corrected to FINISHED_POINTS_PENDING`)
      }
    }

    return NextResponse.json({
      success: true,
      status: tournament.status,
      isFinalized: ['FINISHED_POINTS_PENDING', 'FINISHED_POINTS_CALCULATED'].includes(tournament.status),
      finalCompleted,
      winner_id: tournament.winner_id
    })

  } catch (error) {
    console.error('Finalization status error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}