import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    console.log('[API /api/matches/[matchId]/sets] Request for matchId:', matchId)

    if (!matchId) {
      console.log('[API /api/matches/[matchId]/sets] No matchId provided')
      return NextResponse.json({
        success: false,
        error: 'Match ID is required'
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('[API /api/matches/[matchId]/sets] Auth error:', authError)
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    console.log('[API /api/matches/[matchId]/sets] Fetching sets for matchId:', matchId)

    // Obtener sets del match
    const { data: sets, error: setsError } = await supabase
      .from('set_matches')
      .select('id, set_number, couple1_games, couple2_games, winner_couple_id, status')
      .eq('match_id', matchId)
      .order('set_number', { ascending: true })

    if (setsError) {
      console.error('[API /api/matches/[matchId]/sets] Error fetching sets:', setsError)
      return NextResponse.json({
        success: false,
        error: 'Error fetching sets data'
      }, { status: 500 })
    }

    console.log('[API /api/matches/[matchId]/sets] Found sets:', sets?.length || 0, 'for match:', matchId)

    return NextResponse.json({
      success: true,
      sets: sets || []
    })

  } catch (error) {
    console.error('Match sets error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}