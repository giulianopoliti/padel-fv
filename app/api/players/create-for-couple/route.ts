import { NextRequest, NextResponse } from "next/server"

import { createPlayerForCoupleService } from "@/lib/services/players/create-player-for-couple"
import { createClient } from "@/utils/supabase/server"

interface CreatePlayerForCoupleBody {
  tournamentId?: string
  playerData?: {
    first_name?: string
    last_name?: string
    gender?: string
    dni?: string | null
    phone?: string | null
    forceCreateNew?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = (await request.json()) as CreatePlayerForCoupleBody

    if (!body.tournamentId || !body.playerData?.first_name || !body.playerData?.last_name || !body.playerData?.gender) {
      return NextResponse.json(
        {
          success: false,
          message: "Faltan datos obligatorios para crear el jugador.",
        },
        { status: 400 },
      )
    }

    const result = await createPlayerForCoupleService(supabase, {
      tournamentId: body.tournamentId,
      playerData: {
        first_name: body.playerData.first_name,
        last_name: body.playerData.last_name,
        gender: body.playerData.gender,
        dni: body.playerData.dni ?? null,
        phone: body.playerData.phone ?? null,
        forceCreateNew: body.playerData.forceCreateNew ?? false,
      },
    })

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    })
  } catch (error) {
    console.error("[create-for-couple] Unexpected error:", error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo crear el jugador.",
      },
      { status: 500 },
    )
  }
}
