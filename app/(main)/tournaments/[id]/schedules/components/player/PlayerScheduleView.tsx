'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarClock, Building2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { TournamentFecha } from '../../types'
import { useScheduleAccess } from '../../hooks/useScheduleAccess'
import {
  PageLoadingState,
  PlayerAvailabilitySkeleton
} from '../LoadingStates'
import {
  AccessDeniedError,
  NotInscribedError,
  EliminatedCoupleError,
  NetworkError,
  InlineError
} from '../ErrorStates'
import FechaSelector from '../FechaSelector'

// Lazy load the player view component
import { lazy } from 'react'
const PlayerView = lazy(() => import('../PlayerView'))

interface PlayerScheduleViewProps {
  tournamentId: string
  fechas: TournamentFecha[]
  initialFechaId?: string
  tournamentName: string
  clubName: string
  inscriptionDetails?: any
}

export default function PlayerScheduleView({
  tournamentId,
  fechas,
  initialFechaId,
  tournamentName,
  clubName,
  inscriptionDetails
}: PlayerScheduleViewProps) {
  const { userAccess, loading, error, retry } = useScheduleAccess(tournamentId)

  // Determine selected fecha
  const selectedFechaId = initialFechaId || fechas[0]?.id

  // Loading state
  if (loading) {
    return <PageLoadingState />
  }

  // Error states
  if (error) {
    if (error.includes('permisos')) {
      return <AccessDeniedError onRetry={retry} />
    }

    if (error.includes('eliminada')) {
      return <EliminatedCoupleError />
    }

    if (error.includes('inscrito')) {
      return <NotInscribedError />
    }

    return <NetworkError onRetry={retry} />
  }

  // No access data
  if (!userAccess) {
    return <NetworkError onRetry={retry} />
  }

  // Access denied - not inscribed
  if (!userAccess.isInscribed) {
    return <AccessDeniedError onRetry={retry} />
  }

  // No fechas available
  if (!fechas.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-4 lg:py-6">
            <div className="max-w-7xl mx-auto space-y-4">

              {/* Breadcrumb Navigation */}
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/tournaments" className="flex items-center gap-1">
                      <CalendarClock className="h-4 w-4" />
                      Torneos
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/tournaments/${tournamentId}`}>
                      {tournamentName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold">Horarios</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <Separator />

              {/* Title */}
              <div className="flex items-start gap-4 lg:gap-5">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 lg:p-4 rounded-2xl shadow-lg">
                  <CalendarClock className="h-6 w-6 lg:h-7 lg:w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 truncate">
                    Horarios - {tournamentName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">{clubName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <InlineError
              message="No hay fechas disponibles para este torneo."
            />
          </div>
        </div>
      </div>
    )
  }

  // No selected fecha
  if (!selectedFechaId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-4 lg:py-6">
            <div className="max-w-7xl mx-auto space-y-4">

              {/* Breadcrumb Navigation */}
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/tournaments" className="flex items-center gap-1">
                      <CalendarClock className="h-4 w-4" />
                      Torneos
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/tournaments/${tournamentId}`}>
                      {tournamentName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold">Horarios</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <Separator />

              {/* Title */}
              <div className="flex items-start gap-4 lg:gap-5">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 lg:p-4 rounded-2xl shadow-lg">
                  <CalendarClock className="h-6 w-6 lg:h-7 lg:w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 truncate">
                    Horarios - {tournamentName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">{clubName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <FechaSelector
              tournamentId={tournamentId}
              fechas={fechas}
              selectedFechaId={selectedFechaId}
            />

            <InlineError
              message="Selecciona una fecha para ver los horarios disponibles."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 lg:py-6">
          <div className="max-w-7xl mx-auto space-y-4">

            {/* Breadcrumb Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/tournaments" className="flex items-center gap-1">
                      <CalendarClock className="h-4 w-4" />
                      Torneos
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/tournaments/${tournamentId}`}>
                      {tournamentName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold">Horarios</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="flex items-center gap-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm">
                  Horarios
                </div>
                <div className="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm">
                  Vista Jugador
                </div>
              </div>
            </div>

            <Separator />

            {/* Title Section */}
            <div className="flex items-start gap-4 lg:gap-5">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 lg:p-4 rounded-2xl shadow-lg">
                <CalendarClock className="h-6 w-6 lg:h-7 lg:w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 truncate">
                  Horarios - {tournamentName}
                </h1>

                <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">{clubName}</span>
                  </div>
                  {inscriptionDetails && (
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
                      <span className="text-green-700 font-medium">
                        Pareja: {inscriptionDetails.couple.player1_name} / {inscriptionDetails.couple.player2_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">

          {/* Fecha Selector */}
          <FechaSelector
            tournamentId={tournamentId}
            fechas={fechas}
            selectedFechaId={selectedFechaId}
          />

          {/* Main Content */}
          <div className="space-y-6">
            <Suspense fallback={<PlayerAvailabilitySkeleton />}>
              <PlayerView
                tournamentId={tournamentId}
                fechaId={selectedFechaId}
                userAccess={userAccess}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}