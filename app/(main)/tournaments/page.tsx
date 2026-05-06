import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Redirect to upcoming tournaments by default
export default function TournamentsPage() {
  redirect('/tournaments/upcoming')
} 