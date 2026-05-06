import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { checkTournamentPermissions } from "@/utils/tournament-permissions"
import ScheduleManagementContainer from "./components/ScheduleManagementContainer"

interface ScheduleManagementPageProps {
  params: {
    id: string
  }
  searchParams: {
    fecha_id?: string
  }
}

export default async function ScheduleManagementPage({ params, searchParams }: ScheduleManagementPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  // Basic auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check tournament permissions
  const permissionResult = await checkTournamentPermissions(user.id, resolvedParams.id)
  if (!permissionResult.hasPermission) {
    redirect('/tournaments')
  }

  // Get tournament basic info
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select(`
      id,
      name,
      type,
      status,
      clubes:club_id (
        name
      )
    `)
    .eq('id', resolvedParams.id)
    .single()

  if (tournamentError || !tournament) {
    redirect('/tournaments')
  }

  // Verify it's a long tournament (dates and schedules only apply to long tournaments)
  if (tournament.type !== 'LONG') {
    redirect(`/tournaments/${resolvedParams.id}`)
  }

  // Get existing fechas with comprehensive data
  const { data: fechas } = await supabase
    .from('tournament_fechas')
    .select(`
      *,
      _count_time_slots:tournament_time_slots(count)
    `)
    .eq('tournament_id', resolvedParams.id)
    .order('fecha_number', { ascending: true })

  // Handle fecha selection from URL
  const selectedFechaId = resolvedSearchParams.fecha_id
  let validatedFechaId: string | null = null

  if (selectedFechaId) {
    // Validate that the fecha exists
    const fechaExists = fechas?.some(f => f.id === selectedFechaId)
    if (fechaExists) {
      validatedFechaId = selectedFechaId
    } else {
      // Redirect to page without invalid fecha param
      redirect(`/tournaments/${resolvedParams.id}/schedule-management`)
    }
  } else if (fechas && fechas.length > 0) {
    // If no fecha selected but fechas exist, redirect to first fecha
    redirect(`/tournaments/${resolvedParams.id}/schedule-management?fecha_id=${fechas[0].id}`)
  }

  return (
    <ScheduleManagementContainer
      tournamentId={resolvedParams.id}
      tournamentName={tournament.name}
      clubName={tournament.clubes?.name || 'Sin club'}
      fechas={fechas || []}
      initialSelectedFechaId={validatedFechaId}
    />
  )
}