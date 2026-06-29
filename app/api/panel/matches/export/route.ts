import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { buildOrganizerMatchesXlsx } from "@/lib/organizer-matches-export"
import {
  getOrganizationScheduledMatches,
  parseOrganizerMatchesFilters,
} from "@/lib/organizer-matches"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userError || !userData || userData.role !== "ORGANIZADOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { data: orgMember, error: orgError } = await supabase
    .from("organization_members")
    .select("organizacion_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single()

  if (orgError || !orgMember) {
    return NextResponse.json({ error: "No tienes organización activa" }, { status: 403 })
  }

  const filters = parseOrganizerMatchesFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  const matches = await getOrganizationScheduledMatches(orgMember.organizacion_id, filters)
  const excelContent = buildOrganizerMatchesXlsx(matches)
  const filenameDate =
    filters.fromDate === filters.toDate
      ? filters.fromDate
      : `${filters.fromDate}_a_${filters.toDate}`

  return new NextResponse(new Uint8Array(excelContent), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="partidos-organizacion-${filenameDate}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
