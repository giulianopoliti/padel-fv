import { NextResponse } from "next/server";
import { getCouplesWithFinishedMatches, getAllCouplesWithActiveMatches } from "../actions";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await ctx.params
    const url = new URL(request.url)
    const zoneId = url.searchParams.get("zoneId")
    
    // If zoneId provided: get couples with finished matches in specific zone
    // If no zoneId: get all couples with active matches in tournament (for general restrictions)
    if (zoneId) {
      const result = await getCouplesWithFinishedMatches(tournamentId, zoneId)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    } else {
      const result = await getAllCouplesWithActiveMatches(tournamentId)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }
  } catch (error) {
    console.error("Error getting couples with active matches:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}