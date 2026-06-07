import { NextRequest, NextResponse } from "next/server"

import { parseWorkbookBuffer, type PreviewImportPlayer, type PreviewImportRow } from "@/lib/services/imports/tournament-inscriptions-import"
import { resolvePlayerIdentity } from "@/lib/services/player-identity-service"
import { createClient } from "@/utils/supabase/server"
import { checkTournamentAccess } from "@/utils/tournament-permissions"

export const runtime = "nodejs"

const getPlayerTournamentInscriptionStatus = async (
  supabase: any,
  tournamentId: string,
  playerId: string,
): Promise<{ alreadyInscribed: boolean; inscriptionLabel: string | null }> => {
  const { data: directInscriptions } = await supabase
    .from("inscriptions")
    .select("id, couple_id")
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .limit(1)

  const directInscription = directInscriptions?.[0]
  if (directInscription) {
    return {
      alreadyInscribed: true,
      inscriptionLabel: directInscription.couple_id ? "Ya inscripto en pareja" : "Ya inscripto como jugador suelto",
    }
  }

  const { data: couples } = await supabase
    .from("couples")
    .select("id")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

  const coupleIds = (couples || []).map((couple: any) => couple.id).filter(Boolean)
  if (coupleIds.length === 0) {
    return { alreadyInscribed: false, inscriptionLabel: null }
  }

  const { data: coupleInscriptions } = await supabase
    .from("inscriptions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .in("couple_id", coupleIds)
    .limit(1)

  return {
    alreadyInscribed: (coupleInscriptions || []).length > 0,
    inscriptionLabel: (coupleInscriptions || []).length > 0 ? "Ya inscripto en pareja" : null,
  }
}

const buildPreviewPlayer = async (
  supabase: any,
  tournamentId: string,
  player: PreviewImportRow["player1"],
): Promise<PreviewImportPlayer | null> => {
  if (!player) return null

  const identityResult = await resolvePlayerIdentity({
    firstName: player.firstName,
    lastName: player.lastName,
    dni: player.dni,
    gender: player.gender,
    limit: 5,
  })

  const candidates = await Promise.all(
    (identityResult.candidates || []).map(async (candidate) => {
      const status = await getPlayerTournamentInscriptionStatus(supabase, tournamentId, candidate.id)
      return {
        ...candidate,
        alreadyInscribed: status.alreadyInscribed,
        inscriptionLabel: status.inscriptionLabel,
      }
    }),
  )

  const primaryCandidate = identityResult.primary
    ? candidates.find((candidate) => candidate.id === identityResult.primary?.id) || identityResult.primary
    : null

  return {
    ...player,
    candidates,
    primaryCandidate,
    hasStrongMatch: !!identityResult.hasStrongMatch,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, gender")
      .eq("id", tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: "Torneo no encontrado." }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const sheetName = formData.get("sheetName")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo Excel." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsedWorkbook = parseWorkbookBuffer(buffer, {
      sheetName: typeof sheetName === "string" ? sheetName : null,
      tournamentGender: tournament.gender,
    })

    const previewRows: PreviewImportRow[] = []

    for (const row of parsedWorkbook.rows) {
      const player1 = await buildPreviewPlayer(supabase, tournamentId, row.player1 as PreviewImportPlayer | null)
      const player2 = await buildPreviewPlayer(supabase, tournamentId, row.player2 as PreviewImportPlayer | null)

      previewRows.push({
        ...row,
        player1,
        player2,
      })
    }

    return NextResponse.json({
      sheetNames: parsedWorkbook.sheetNames,
      selectedSheetName: parsedWorkbook.selectedSheetName,
      rows: previewRows,
    })
  } catch (error) {
    console.error("[inscriptions-import-preview] Unexpected error:", error)
    return NextResponse.json({ error: "No se pudo procesar el Excel." }, { status: 500 })
  }
}
