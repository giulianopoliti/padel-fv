import { redirect } from 'next/navigation'
import { getDefaultPublicTournamentType } from '@/config/tenant'

export const dynamic = 'force-dynamic'

// Redirect to upcoming tournaments by default
export default function TournamentsPage() {
  const defaultType = getDefaultPublicTournamentType()
  redirect(`/tournaments/upcoming?type=${defaultType}`)
} 
