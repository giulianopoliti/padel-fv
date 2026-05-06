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

    // Obtener todos los matches del torneo para filtrar
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { success: false, error: 'Error fetching tournament matches' },
        { status: 500 }
      )
    }

    const matchIds = matches?.map(m => m.id) || []

    if (matchIds.length === 0) {
      return NextResponse.json({
        success: true,
        points: {},
        count: 0
      })
    }

    // Obtener puntos para todos los matches del torneo
    const { data: pointsData, error: pointsError } = await supabase
      .from('match_points_couples')
      .select(`
        match_id,
        points_winner,
        points_loser,
        created_at
      `)
      .in('match_id', matchIds)

    if (pointsError) {
      console.error('Error fetching match points:', pointsError)
      return NextResponse.json(
        { success: false, error: 'Error fetching match points' },
        { status: 500 }
      )
    }

    // Convertir a formato de objeto indexado por match_id
    const pointsByMatch = (pointsData || []).reduce((acc, point) => {
      acc[point.match_id] = {
        points_winner: point.points_winner,
        points_loser: point.points_loser
      }
      return acc
    }, {} as Record<string, { points_winner: number; points_loser: number }>)

    return NextResponse.json({
      success: true,
      points: pointsByMatch,
      count: pointsData?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in match-points route:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}