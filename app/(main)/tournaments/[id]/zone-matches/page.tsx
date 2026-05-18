import React from 'react'
import { notFound } from 'next/navigation'
import { getTournamentCategoryDisplay } from '@/lib/services/tournament-category-config'
import { createClient } from '@/utils/supabase/server'
import ZoneMatchesView from './components/ZoneMatchesView'

interface ZoneMatchesPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ zone?: string }>
}

export default async function ZoneMatchesPage({ params, searchParams }: ZoneMatchesPageProps) {
  const supabase = await createClient()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, name, category_name, category_config, type')
    .eq('id', resolvedParams.id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  const tournamentCategoryDisplay = getTournamentCategoryDisplay(tournament)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Partidos de Zona</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{tournament.name}</span>
                {tournamentCategoryDisplay ? (
                  <>
                    <span>•</span>
                    <span>{tournamentCategoryDisplay}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <ZoneMatchesView tournamentId={resolvedParams.id} selectedZoneId={resolvedSearchParams.zone} />
      </div>
    </div>
  )
}
