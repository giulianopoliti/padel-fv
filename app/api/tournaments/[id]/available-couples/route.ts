import { NextResponse } from "next/server"
import { fetchAvailableCouples } from "../actions"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const result = await fetchAvailableCouples(id)
    if (!result.success) return NextResponse.json(result, { status: 500 })
    return NextResponse.json({ success: true, couples: result.couples })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
} 