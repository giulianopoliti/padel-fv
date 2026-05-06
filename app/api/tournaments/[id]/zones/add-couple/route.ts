import { NextResponse } from "next/server"
import { addCoupleToZone } from "../../actions"

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, zoneId, capacity } = await req.json()
    
    const result = await addCoupleToZone(tournamentId, coupleId, zoneId, capacity)
    
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