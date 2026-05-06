import { NextResponse } from "next/server"
import { fetchTournamentZones } from "../actions"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const result = await fetchTournamentZones(id)
    if (!result.success) return NextResponse.json(result, { status: 500 })
    return NextResponse.json({ success: true, zones: result.zones })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
} 