'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trophy, Calendar } from 'lucide-react'
import LongBracketView from './LongBracketView'
import LongScheduleView from './LongScheduleView'
import { LongBracketGenerator } from '@/components/tournament/long/LongBracketGenerator'
import ReadOnlyBracketVisualization from '@/components/tournament/bracket-v2/components/ReadOnlyBracketVisualization'
import { PointsCalculationBanner } from '@/components/tournament/bracket-v2/components/PointsCalculationBanner'
import { useTournament } from '@/hooks/use-tournament'
import { useTournamentFinalization } from '@/components/tournament/bracket-v2/hooks/useTournamentFinalization'

type ViewMode = 'bracket' | 'schedule'

const ACTIVE_BRACKET_STATUSES = ['BRACKET_PHASE', 'FINISHED_POINTS_PENDING', 'FINISHED_POINTS_CALCULATED']

interface BracketContainerProps {
  tournamentId: string
  isOwner: boolean
  isPublicView: boolean
}

export default function BracketContainer({
  tournamentId,
  isOwner,
  isPublicView
}: BracketContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('bracket')
  const { tournament, isLoading } = useTournament(tournamentId)
  const finalization = useTournamentFinalization(tournamentId)

  const isInOrFinishedBracketPhase = ACTIVE_BRACKET_STATUSES.includes(tournament?.status ?? '')
  const shouldShowReadOnlyView = !isOwner || tournament?.status === 'FINISHED_POINTS_CALCULATED'

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-muted-foreground">Cargando torneo...</p>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-destructive">Error al cargar el torneo</p>
        </div>
      </div>
    )
  }

  if (shouldShowReadOnlyView) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <ReadOnlyBracketVisualization
            tournamentId={tournamentId}
            tournamentStatus={tournament.status}
            tournamentType={tournament.type || 'LONG'}
          />
        </div>
      </div>
    )
  }

  // Para organizadores: Solo mostrar el generador si el bracket nunca fue creado
  if (!isInOrFinishedBracketPhase) {
    return (
      <div className="px-4 lg:px-6">
        <div className="max-w-2xl mx-auto">
          <LongBracketGenerator
            tournamentId={tournamentId}
            tournament={tournament}
            onBracketGenerated={() => {
              window.location.reload()
            }}
          />
        </div>
      </div>
    )
  }

  // Bracket activo o finalizado: mostrar interfaz de gestión
  return (
    <div>
      {/* Banner de puntos (solo cuando el torneo está finalizado y hay puntos pendientes) */}
      {isOwner && finalization.canShowPointsCalculation && (
        <div className="px-4 lg:px-6 pt-4">
          <PointsCalculationBanner
            tournamentId={tournamentId}
            winnerId={finalization.winner_id}
            onPointsCalculated={() => finalization.refetch()}
          />
        </div>
      )}

      {/* Header con toggle */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 lg:px-6 py-4">
          <div className="max-w-none lg:max-w-7xl lg:mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <Button
                  variant={viewMode === 'bracket' ? 'default' : 'outline'}
                  onClick={() => setViewMode('bracket')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">Vista Llave</span>
                  <span className="sm:hidden">Llave</span>
                </Button>
                <Button
                  variant={viewMode === 'schedule' ? 'default' : 'outline'}
                  onClick={() => setViewMode('schedule')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Vista Horarios</span>
                  <span className="sm:hidden">Horarios</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  tournament.type === 'LONG'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {tournament.type === 'LONG' ? 'Torneo Largo' : 'Torneo Americano'}
                </div>
                {viewMode === 'schedule' && (
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                    Vista Matriz
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 py-4 lg:py-6">
        <div className="max-w-none lg:max-w-7xl lg:mx-auto">
          {viewMode === 'bracket' ? (
            <LongBracketView
              tournamentId={tournamentId}
              onMatchUpdate={() => finalization.refetch()}
            />
          ) : (
            <LongScheduleView tournamentId={tournamentId} />
          )}
        </div>
      </div>
    </div>
  )
}
