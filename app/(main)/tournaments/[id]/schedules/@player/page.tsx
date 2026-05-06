import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { checkUserTournamentInscription } from "@/utils/tournament-permissions"
import ScheduleContainer from "../components/ScheduleContainer"

interface PlayerSchedulePageProps {
  params: {
    id: string
  }
  searchParams: {
    fecha_id?: string
  }
}

export default async function PlayerSchedulePage({
  params,
  searchParams
}: PlayerSchedulePageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  // Basic auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user is inscribed
  const inscriptionResult = await checkUserTournamentInscription(user.id, resolvedParams.id)
  if (!inscriptionResult.isInscribed) {
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

  // Get tournament fechas
  const { data: fechas } = await supabase
    .from('tournament_fechas')
    .select('id, name, fecha_number, description, status, start_date, end_date, round_type, max_matches_per_couple, tournament_id')
    .eq('tournament_id', resolvedParams.id)
    .order('fecha_number', { ascending: true })

  return (
    <ScheduleContainer
      tournamentId={resolvedParams.id}
      fechas={fechas || []}
      initialFechaId={resolvedSearchParams.fecha_id}
      tournamentName={tournament.name}
      clubName={tournament.clubes?.name || 'Sin club'}
    />
  )
}