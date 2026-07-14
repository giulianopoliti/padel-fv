import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { getTournamentCategoryDisplay } from '@/lib/services/tournament-category-config'
import PublicBracketTreeView from '@/components/tournament/bracket-v2/components/PublicBracketTreeView'

interface PlayerBracketPageProps {
  params: Promise<{ id: string }>
}

export default async function PlayerBracketPage({ params }: PlayerBracketPageProps) {
  const supabase = await createClient()
  const { id } = await params

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, name, category_name, category_config, format_config, type, status')
    .eq('id', id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  const tournamentCategoryDisplay = getTournamentCategoryDisplay(tournament)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Llave del Torneo
            </h1>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{tournament.name}</h2>
              {tournamentCategoryDisplay ? <p className="text-sm text-muted-foreground">{tournamentCategoryDisplay}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:px-6">
        <PublicBracketTreeView
          tournamentId={id}
          tournamentType={tournament.type as 'AMERICAN' | 'LONG'}
          tournamentFormatConfig={tournament.format_config}
        />
      </div>
    </div>
  )
}
