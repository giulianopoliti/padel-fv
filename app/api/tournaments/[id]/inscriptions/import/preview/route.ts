import { NextRequest, NextResponse } from "next/server"

import { parseWorkbookBuffer, type PreviewImportPlayer, type PreviewImportRow } from "@/lib/services/imports/tournament-inscriptions-import"
import { resolvePlayerIdentity } from "@/lib/services/player-identity-service"
import { createClient } from "@/utils/supabase/server"
import { checkTournamentAccess } from "@/utils/tournament-permissions"

export const runtime = "nodejs"

const buildPreviewPlayer = async (
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

  return {
    ...player,
    candidates: identityResult.candidates || [],
    primaryCandidate: identityResult.primary || null,
    hasStrongMatch: !!identityResult.hasStrongMatch,
  }
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
      const player1 = await buildPreviewPlayer(row.player1 as PreviewImportPlayer | null)
      const player2 = await buildPreviewPlayer(row.player2 as PreviewImportPlayer | null)

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
