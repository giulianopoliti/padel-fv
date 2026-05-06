import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { checkTournamentPermissions } from "@/utils/tournament-permissions"
import DatesContainer from "./components/DatesContainer"

interface DatesPageProps {
  params: {
    id: string
  }
}

export default async function DatesPage({ params }: DatesPageProps) {
  const resolvedParams = await params
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

  // Verify it's a long tournament
  if (tournament.type !== 'LONG') {
    redirect(`/tournaments/${resolvedParams.id}`)
  }

  // Get existing fechas
  const { data: fechas } = await supabase
    .from('tournament_fechas')
    .select('*')
    .eq('tournament_id', resolvedParams.id)
    .order('fecha_number', { ascending: true })

  return (
    <DatesContainer
      tournamentId={resolvedParams.id}
      tournamentName={tournament.name}
      clubName={tournament.clubes?.name || 'Sin club'}
      fechas={fechas || []}
    />
  )
}