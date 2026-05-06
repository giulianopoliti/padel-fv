import { NextResponse } from "next/server"
import { moveCoupleToZone } from "../../actions"

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, fromZoneId, toZoneId, capacity } = await req.json()
    
    const result = await moveCoupleToZone(tournamentId, fromZoneId, toZoneId, coupleId, capacity)
    
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e.message }, 
      { status: 500 }
    )
  }
}