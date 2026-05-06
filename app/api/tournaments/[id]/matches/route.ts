import { NextRequest, NextResponse } from 'next/server'
import { getMatchesByTournamentId } from '../../actions'
import { createApiResponse } from '@/utils/serialization'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    if (!tournamentId) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 })
    }

    const matches = await getMatchesByTournamentId(tournamentId)
    
    return NextResponse.json(createApiResponse({
      success: true,
      matches: matches || []
    }))
  } catch (error) {
    console.error('Error fetching tournament matches:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tournament matches'
    }, { status: 500 })
  }
}