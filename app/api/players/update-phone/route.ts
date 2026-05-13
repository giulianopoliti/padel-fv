import { NextRequest, NextResponse } from "next/server"

import { updatePlayerPhone } from "@/app/api/players/actions"

interface UpdatePhoneBody {
  playerId?: string
  phone?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdatePhoneBody

    if (!body.playerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el jugador a actualizar.",
        },
        { status: 400 },
      )
    }

    const result = await updatePlayerPhone(body.playerId, body.phone || "")

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    })
  } catch (error) {
    console.error("[update-phone] Unexpected error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo actualizar el teléfono.",
      },
      { status: 500 },
    )
  }
}
