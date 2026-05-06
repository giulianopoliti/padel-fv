import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params

    if (!matchId) {
      return NextResponse.json({
        success: false,
        error: 'Match ID is required'
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Obtener datos básicos del match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, result_couple1, result_couple2, winner_id, tournament_id')
      .eq('id', matchId)
      .single()

    if (matchError) {
      console.error('Error fetching match:', matchError)
      return NextResponse.json({
        success: false,
        error: 'Match not found'
      }, { status: 404 })
    }

    if (!match) {
      return NextResponse.json({
        success: false,
        error: 'Match not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        status: match.status,
        result_couple1: match.result_couple1,
        result_couple2: match.result_couple2,
        winner_id: match.winner_id
      }
    })

  } catch (error) {
    console.error('Match summary error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}