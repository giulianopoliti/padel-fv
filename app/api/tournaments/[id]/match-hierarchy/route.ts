import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    const tournamentId = resolvedParams.id

    // Validar parámetros
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    // Obtener jerarquía de matches
    const { data: hierarchy, error } = await supabase
      .from('match_hierarchy')
      .select(`
        parent_match_id,
        child_match_id,
        parent_slot,
        parent_round,
        child_round
      `)
      .eq('tournament_id', tournamentId)
      .order('parent_round')
      .order('parent_slot')

    if (error) {
      console.error('Error fetching match hierarchy:', error)
      return NextResponse.json(
        { success: false, error: 'Error fetching match hierarchy' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hierarchy: hierarchy || [],
      count: hierarchy?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in match-hierarchy route:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}