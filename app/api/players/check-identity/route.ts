import { NextRequest, NextResponse } from "next/server"
import { checkPlayerIdentity } from "@/app/api/players/actions"

interface CheckIdentityRequestBody {
  firstName?: string
  lastName?: string
  dni?: string | null
  gender?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckIdentityRequestBody
    const result = await checkPlayerIdentity({
      firstName: body.firstName || "",
      lastName: body.lastName || "",
      dni: body.dni || null,
      gender: body.gender || null,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error interno del servidor" },
        { status: result.status || 500 },
      )
    }

    if (!result.player) {
      return NextResponse.json({
        exists: false,
        matchedBy: null,
        player: null,
      })
    }

    return NextResponse.json({
      exists: true,
      matchedBy: result.matchedBy,
      player: {
        id: result.player.id,
        first_name: result.player.first_name,
        last_name: result.player.last_name,
        dni: result.player.dni,
        score: result.player.score,
        category_name: result.player.category_name,
      },
    })
  } catch (error) {
    console.error("[check-identity] Unexpected error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    )
  }
}
