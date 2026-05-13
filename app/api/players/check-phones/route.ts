import { NextRequest, NextResponse } from "next/server"

import { checkPlayersPhones } from "@/app/api/players/actions"

interface CheckPhonesBody {
  player1Id?: string
  player2Id?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckPhonesBody

    if (!body.player1Id || !body.player2Id) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requieren ambos jugadores para verificar teléfonos.",
        },
        { status: 400 },
      )
    }

    const result = await checkPlayersPhones(body.player1Id, body.player2Id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[check-phones] Unexpected error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "No se pudieron verificar los teléfonos.",
      },
      { status: 500 },
    )
  }
}
