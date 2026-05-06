import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params

    // Get all matches for this tournament
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', resolvedParams.id)
      .neq('round', 'ZONE')

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { error: 'Error fetching matches' },
        { status: 500 }
      )
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ sets: {} })
    }

    const matchIds = matches.map(m => m.id)

    // Get all set_matches for these matches
    const { data: sets, error: setsError } = await supabase
      .from('set_matches')
      .select('*')
      .in('match_id', matchIds)
      .order('match_id')
      .order('set_number')

    if (setsError) {
      console.error('Error fetching set_matches:', setsError)
      return NextResponse.json(
        { error: 'Error fetching set_matches' },
        { status: 500 }
      )
    }

    // Group sets by match_id
    const setsByMatch: Record<string, any[]> = {}

    if (sets) {
      sets.forEach(set => {
        if (!setsByMatch[set.match_id]) {
          setsByMatch[set.match_id] = []
        }
        setsByMatch[set.match_id].push(set)
      })
    }

    return NextResponse.json({ sets: setsByMatch })
  } catch (error) {
    console.error('Error in set-matches endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
