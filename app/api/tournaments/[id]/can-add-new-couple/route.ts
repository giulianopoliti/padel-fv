import { NextResponse } from "next/server"
import { canAddNewCouple } from "../actions"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const result = await canAddNewCouple(id)
    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json(
      { canAdd: false, reason: e?.message || "Internal server error" },
      { status: 500 }
    )
  }
}


