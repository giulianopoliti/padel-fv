import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: tournamentId } = await params

    // Obtener estado del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('status, winner_id, end_date, type, format_type, format_config')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found'
      }, { status: 404 })
    }

    const resolvedFormat = TournamentFormatResolver.getResolvedFormat(tournament || {})
    const winnerBracketKey = resolvedFormat.effectiveBracketMode === 'GOLD_SILVER' ? 'GOLD' : 'MAIN'

    // Verificar si hay final terminada
    let finalMatchQuery = supabase
      .from('matches')
      .select('id, status, winner_id, round')
      .eq('tournament_id', tournamentId)
      .eq('round', 'FINAL')
      .eq('type', 'ELIMINATION')
      .eq('bracket_key', winnerBracketKey)
      .maybeSingle()

    const { data: finalMatch } = await finalMatchQuery

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
