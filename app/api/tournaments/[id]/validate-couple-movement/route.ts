import { NextResponse } from 'next/server'
import { validateCoupleMovement } from '@/utils/tournament-restrictions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, fromZoneId } = await request.json()

    if (!coupleId) {
      return NextResponse.json(
        { error: 'coupleId is required' },
        { status: 400 }
      )
    }

    const validation = await validateCoupleMovement(tournamentId, coupleId, fromZoneId)
    
    return NextResponse.json(validation)
  } catch (error: any) {
    console.error('[validate-couple-movement] Error:', error)
    return NextResponse.json(
      { error: 'Validation failed', details: error.message },
      { status: 500 }
    )
  }
}