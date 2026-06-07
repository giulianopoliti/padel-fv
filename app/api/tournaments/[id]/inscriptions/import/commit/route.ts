import { NextRequest, NextResponse } from "next/server"

import { registerCoupleForTournament } from "@/app/api/tournaments/actions"
import { createPlayerForCoupleService } from "@/lib/services/players/create-player-for-couple"
import { getImportPlayerKey, type CommitImportRow, type ImportPlayerDecision, type ParsedImportPlayer } from "@/lib/services/imports/tournament-inscriptions-import"
import { registerIndividualPlayer } from "@/lib/services/registration"
import { createClient } from "@/utils/supabase/server"
import { checkTournamentAccess } from "@/utils/tournament-permissions"

interface CommitRequestBody {
  rows?: CommitImportRow[]
}

interface ResolvedPlayerResult {
  success: boolean
  playerId?: string
  created?: boolean
  error?: string
}

const getDirectOrCoupleInscription = async (
  supabase: any,
  tournamentId: string,
  playerId: string,
): Promise<{ exists: boolean; error?: string }> => {
  const { data: directInscription, error: directError } = await supabase
    .from("inscriptions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .maybeSingle()

  if (directError) {
    return { exists: false, error: directError.message }
  }

  if (directInscription) {
    return { exists: true }
  }

  const { data: couples, error: couplesError } = await supabase
    .from("couples")
    .select("id")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

  if (couplesError) {
    return { exists: false, error: couplesError.message }
  }

  const coupleIds = (couples || []).map((couple: any) => couple.id).filter(Boolean)
  if (coupleIds.length === 0) {
    return { exists: false }
  }

  const { data: coupleInscription, error: coupleInscriptionError } = await supabase
    .from("inscriptions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .in("couple_id", coupleIds)
    .limit(1)

  if (coupleInscriptionError) {
    return { exists: false, error: coupleInscriptionError.message }
  }

  return { exists: (coupleInscription || []).length > 0 }
}

const resolveImportPlayer = async ({
  supabase,
  tournamentId,
  player,
  decision,
  createdPlayerCache,
}: {
  supabase: any
  tournamentId: string
  player: ParsedImportPlayer | null
  decision?: ImportPlayerDecision
  createdPlayerCache: Map<string, string>
}): Promise<ResolvedPlayerResult> => {
  if (!player) {
    return { success: true }
  }

  const action = decision?.action || "create"

  if (action === "skip") {
    return { success: true }
  }

  if (action === "use") {
    if (!decision?.playerId) {
      return { success: false, error: "Falta el jugador existente seleccionado." }
    }

    return { success: true, playerId: decision.playerId, created: false }
  }

  if (!player.firstName || !player.lastName) {
    return { success: false, error: `Faltan nombre o apellido para ${player.fullName}.` }
  }

  const cacheKey = getImportPlayerKey(player)
  if (cacheKey && createdPlayerCache.has(cacheKey)) {
    return { success: true, playerId: createdPlayerCache.get(cacheKey), created: false }
  }

  const createResult = await createPlayerForCoupleService(supabase, {
    tournamentId,
    playerData: {
      first_name: player.firstName,
      last_name: player.lastName,
      gender: player.gender,
      dni: player.dni,
      forceCreateNew: true,
    },
  })

  if (!createResult.success || !createResult.playerId) {
    return { success: false, error: createResult.message || "No se pudo crear el jugador." }
  }

  if (cacheKey) {
    createdPlayerCache.set(cacheKey, createResult.playerId)
  }

  return { success: true, playerId: createResult.playerId, created: true }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const resolvedParams = await params
    const tournamentId = resolvedParams.id
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const access = await checkTournamentAccess(user?.id || null, tournamentId)

    if (!access.permissions.includes("manage_inscriptions")) {
      return NextResponse.json({ error: "No tienes permisos para importar inscripciones." }, { status: 403 })
    }

    const body = (await request.json()) as CommitRequestBody
    const rows = body.rows || []

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No hay filas para importar." }, { status: 400 })
    }

    const createdPlayerCache = new Map<string, string>()
    const results: Array<{
      rowId: string
      rowNumber: number
      status: "success" | "error" | "skipped"
      type: "couple" | "individual"
      message: string
      coupleId?: string
      playerId?: string
      createdPlayers: number
    }> = []

    for (const row of rows) {
      const player1Result = await resolveImportPlayer({
        supabase,
        tournamentId,
        player: row.player1,
        decision: row.decisions?.player1,
        createdPlayerCache,
      })

      const player2Result = await resolveImportPlayer({
        supabase,
        tournamentId,
        player: row.player2,
        decision: row.decisions?.player2,
        createdPlayerCache,
      })

      const createdPlayers = Number(!!player1Result.created) + Number(!!player2Result.created)

      if (!player1Result.success || !player2Result.success) {
        results.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: "error",
          type: row.player1 && row.player2 ? "couple" : "individual",
          message: player1Result.error || player2Result.error || "No se pudo resolver la fila.",
          createdPlayers,
        })
        continue
      }

      const resolvedPlayerIds = [player1Result.playerId, player2Result.playerId].filter(Boolean) as string[]

      if (resolvedPlayerIds.length === 0) {
        results.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: "skipped",
          type: row.player1 && row.player2 ? "couple" : "individual",
          message: "Fila omitida.",
          createdPlayers,
        })
        continue
      }

      if (resolvedPlayerIds.length === 2) {
        const [player1Id, player2Id] = resolvedPlayerIds
        const registrationResult = await registerCoupleForTournament(tournamentId, player1Id, player2Id, true)

        results.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: registrationResult.success ? "success" : "error",
          type: "couple",
          message: registrationResult.success
            ? "Pareja importada correctamente."
            : registrationResult.error || "No se pudo inscribir la pareja.",
          coupleId: registrationResult.inscription?.couple_id || registrationResult.inscription?.coupleId,
          createdPlayers,
        })
        continue
      }

      const playerId = resolvedPlayerIds[0]
      const existingMembership = await getDirectOrCoupleInscription(supabase, tournamentId, playerId)

      if (existingMembership.error) {
        results.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: "error",
          type: "individual",
          message: `No se pudo verificar si el jugador ya estaba inscripto: ${existingMembership.error}`,
          playerId,
          createdPlayers,
        })
        continue
      }

      if (existingMembership.exists) {
        results.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: "error",
          type: "individual",
          message: "El jugador ya esta inscripto en este torneo.",
          playerId,
          createdPlayers,
        })
        continue
      }

      const registrationResult = await registerIndividualPlayer({ tournamentId, playerId })

      results.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        status: registrationResult.success ? "success" : "error",
        type: "individual",
        message: registrationResult.success
          ? "Jugador individual importado correctamente."
          : registrationResult.error || "No se pudo inscribir el jugador.",
        playerId,
        createdPlayers,
      })
    }

    const summary = results.reduce(
      (accumulator, result) => {
        accumulator.total += 1
        accumulator.createdPlayers += result.createdPlayers
        if (result.status === "success" && result.type === "couple") accumulator.couples += 1
        if (result.status === "success" && result.type === "individual") accumulator.individuals += 1
        if (result.status === "error") accumulator.errors += 1
        if (result.status === "skipped") accumulator.skipped += 1
        return accumulator
      },
      { total: 0, couples: 0, individuals: 0, errors: 0, skipped: 0, createdPlayers: 0 },
    )

    return NextResponse.json({ success: summary.errors === 0, summary, results })
  } catch (error) {
    console.error("[inscriptions-import-commit] Unexpected error:", error)
    return NextResponse.json({ error: "No se pudo importar el Excel." }, { status: 500 })
  }
}
