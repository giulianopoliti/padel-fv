import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
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
    .select('id, name, category_name, type')
    .eq('id', resolvedParams.id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Partidos de Zona
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{tournament.name}</span>
                {tournament.category_name && (
                  <>
                    <span>•</span>
                    <span>{tournament.category_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-6">
        <ZoneMatchesView
          tournamentId={resolvedParams.id}
          selectedZoneId={resolvedSearchParams.zone}
        />
      </div>
    </div>
  )
}