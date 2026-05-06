import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { findExistingPlayerByIdentity } from "@/lib/utils/player-identity"

interface CheckIdentityRequestBody {
  firstName?: string
  lastName?: string
  dni?: string | null
  gender?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckIdentityRequestBody
    const firstName = (body.firstName || "").trim()
    const lastName = (body.lastName || "").trim()

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName y lastName son requeridos" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const identityResult = await findExistingPlayerByIdentity({
      supabase,
      firstName,
      lastName,
      dni: body.dni || null,
      gender: body.gender || null,
    })

    if (identityResult.error) {
      return NextResponse.json(
        { error: identityResult.error },
        { status: 500 },
      )
    }

    if (!identityResult.player) {
      return NextResponse.json({
        exists: false,
        matchedBy: null,
        player: null,
      })
    }

    return NextResponse.json({
      exists: true,
      matchedBy: identityResult.matchedBy,
      player: {
        id: identityResult.player.id,
        first_name: identityResult.player.first_name,
        last_name: identityResult.player.last_name,
        dni: identityResult.player.dni,
        score: identityResult.player.score,
        category_name: identityResult.player.category_name,
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
