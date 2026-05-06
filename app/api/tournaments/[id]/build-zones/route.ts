import { NextResponse } from "next/server"
import { buildZonesAction } from "../actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await buildZonesAction(id)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
} 