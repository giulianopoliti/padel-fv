import { NextResponse } from 'next/server'
import { validateAndMoveCoupleToZone } from '@/app/api/tournaments/[id]/actions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, targetZoneId, fromZoneId } = await request.json()

    if (!coupleId || !targetZoneId) {
      return NextResponse.json(
        { error: 'coupleId and targetZoneId are required' },
        { status: 400 }
      )
    }

    const result = await validateAndMoveCoupleToZone(
      tournamentId, 
      coupleId, 
      targetZoneId, 
      fromZoneId
    )
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[move-couple] Error:', error)
    return NextResponse.json(
      { error: 'Move failed', details: error.message },
      { status: 500 }
    )
  }
}