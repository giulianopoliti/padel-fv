import { NextRequest, NextResponse } from 'next/server'
import { createClientServiceRole } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const phase = request.nextUrl.searchParams.get('phase')
    const supabase = await createClientServiceRole()

    let query = supabase
      .from('tournament_couple_disqualifications')
      .select('id, tournament_id, couple_id, player1_id, player2_id, phase, round, zone_id, match_id, reason, status, disqualified_at')
      .eq('tournament_id', tournamentId)
      .eq('status', 'ACTIVE')

    if (phase === 'ZONE_PHASE' || phase === 'BRACKET_PHASE') {
      query = query.eq('phase', phase)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, disqualifications: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo descalificaciones' },
      { status: 500 }
    )
  }
}
