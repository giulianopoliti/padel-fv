import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import BracketClientWrapper from './components/BracketClientWrapper'

interface BracketPageProps {
  params: Promise<{ id: string }>
}

/**
 * Bracket page — children slot (AMERICAN tournaments only).
 *
 * LONG tournaments are handled via parallel routes in layout.tsx:
 *   - Organizers → @organizer/page.tsx → BracketContainer
 *   - Players/public → @player/page.tsx → ReadOnlyBracketVisualization
 *
 * This file only runs for AMERICAN tournaments (or as fallback on layout error).
 * BracketClientWrapper handles owner vs public view internally.
 */
export default async function BracketPage({ params }: BracketPageProps) {
  const supabase = await createClient()
  const resolvedParams = await params

  const { data: { user } } = await supabase.auth.getUser()

  let isOwner = false
  let isPublicView = !user

  if (user) {
    const permissions = await checkTournamentPermissions(user.id, resolvedParams.id)
    isOwner = permissions.hasPermission
  }

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, name, category_name, type, status')
    .eq('id', resolvedParams.id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  return (
    <div className="bg-slate-50">
      <BracketClientWrapper
        tournamentId={resolvedParams.id}
        isOwner={isOwner}
        isPublicView={isPublicView}
      />
    </div>
  )
}
