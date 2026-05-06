import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import BracketContainer from '../components/BracketContainer'

interface OrganizerBracketPageProps {
  params: Promise<{ id: string }>
}

export default async function OrganizerBracketPage({ params }: OrganizerBracketPageProps) {
  const supabase = await createClient()
  const resolvedParams = await params

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, name, category_name, type, status, registration_locked, bracket_status')
    .eq('id', resolvedParams.id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  const ACTIVE_BRACKET_STATUSES = ['BRACKET_PHASE', 'FINISHED_POINTS_PENDING', 'FINISHED_POINTS_CALCULATED']
  const isInOrFinishedBracketPhase = ACTIVE_BRACKET_STATUSES.includes(tournament?.status ?? '')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Solo mostrar header cuando el bracket todavía no fue generado */}
      {!isInOrFinishedBracketPhase && (
        <div className="px-4 lg:px-6 py-4 lg:py-8">
          <div className="max-w-none lg:max-w-7xl lg:mx-auto">
            <div className="mb-6 lg:mb-8 text-center">
              <h1 className="text-xl lg:text-3xl font-bold text-foreground mb-2">
                Generar Llave del Torneo
              </h1>
              <div className="space-y-1">
                <h2 className="text-base lg:text-lg font-semibold text-foreground truncate">
                  {tournament.name}
                </h2>
                {tournament.category_name && (
                  <p className="text-sm text-muted-foreground">
                    {tournament.category_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <BracketContainer
        tournamentId={resolvedParams.id}
        isOwner={true}
        isPublicView={false}
      />
    </div>
  )
}