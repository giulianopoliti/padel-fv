import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface ProcessBYEsRequest {
  matchIds?: string[]  // IDs específicos o todos si no se especifica
  dryRun?: boolean    // Preview sin aplicar cambios
}

interface BYEProcessResult {
  success: boolean
  processedCount: number
  error?: string
  details?: {
    processedMatches: Array<{
      matchId: string
      round: string
      order: number
      winnerId: string
      winnerName: string
      byeType: 'AUTOMATIC' | 'MANUAL'
    }>
    propagatedWinners: Array<{
      fromMatch: string
      toMatch: string
      winnerId: string
      slot: number
    }>
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<BYEProcessResult>> {
  try {
    const tournamentId = params.id
    const body: ProcessBYEsRequest = await request.json()
    const { matchIds, dryRun = false } = body

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Verificar autenticación y permisos (owner)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        processedCount: 0,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Verificar ownership del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('club_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        processedCount: 0,
        error: 'Tournament not found'
      }, { status: 404 })
    }

    const { data: userClub } = await supabase
      .from('users')
      .select('club_id')
      .eq('id', user.id)
      .single()

    if (!userClub || userClub.club_id !== tournament.club_id) {
      return NextResponse.json({
        success: false,
        processedCount: 0,
        error: 'Insufficient permissions'
      }, { status: 403 })
    }

    // Obtener matches con BYE (uno de los slots es null, el otro no)
    let matchesQuery = supabase
      .from('matches')
      .select(`
        id, round, "order", order_in_round, status,
        couple1_id, couple2_id, winner_id,
        couple1:couple1_id (id, player_1, player_2),
        couple2:couple2_id (id, player_1, player_2)
      `)
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')
      .eq('status', 'PENDING')
      .or('couple1_id.is.null,couple2_id.is.null')

    // Filtrar por matches específicos si se proporcionan
    if (matchIds && matchIds.length > 0) {
      matchesQuery = matchesQuery.in('id', matchIds)
    }

    const { data: byeMatches, error: matchesError } = await matchesQuery

    if (matchesError) {
      return NextResponse.json({
        success: false,
        processedCount: 0,
        error: 'Failed to fetch matches'
      }, { status: 500 })
    }

    if (!byeMatches || byeMatches.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        details: {
          processedMatches: [],
          propagatedWinners: []
        }
      })
    }

    // Filtrar solo matches que realmente tienen BYE (uno null, otro no null)
    const validBYEMatches = byeMatches.filter(match => {
      const hasCouple1 = match.couple1_id !== null
      const hasCouple2 = match.couple2_id !== null
      return (hasCouple1 && !hasCouple2) || (!hasCouple1 && hasCouple2)
    })

    if (dryRun) {
      // Preview: mostrar qué se haría sin aplicar cambios
      const previewResults = validBYEMatches.map(match => {
        const winnerId = match.couple1_id || match.couple2_id
        const winner = match.couple1 || match.couple2
        return {
          matchId: match.id,
          round: match.round,
          order: match.order_in_round || match.order,
          winnerId,
          winnerName: winner ? `${winner.player_1}/${winner.player_2}` : 'Unknown',
          byeType: 'AUTOMATIC' as const
        }
      })

      return NextResponse.json({
        success: true,
        processedCount: previewResults.length,
        details: {
          processedMatches: previewResults,
          propagatedWinners: [] // TODO: Calcular propagación en preview
        }
      })
    }

    // Procesar BYEs reales usando RPC
    const { data: result, error: processError } = await supabase.rpc('process_bracket_byes', {
      p_tournament_id: tournamentId,
      p_match_ids: validBYEMatches.map(m => m.id),
      p_user_id: user.id
    })

    if (processError) {
      console.error('BYE processing failed:', processError)
      return NextResponse.json({
        success: false,
        processedCount: 0,
        error: 'Failed to process BYEs'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      processedCount: result?.processed_count || 0,
      details: {
        processedMatches: result?.processed_matches || [],
        propagatedWinners: result?.propagated_winners || []
      }
    })

  } catch (error) {
    console.error('Process BYEs error:', error)
    return NextResponse.json({
      success: false,
      processedCount: 0,
      error: 'Internal server error'
    }, { status: 500 })
  }
}