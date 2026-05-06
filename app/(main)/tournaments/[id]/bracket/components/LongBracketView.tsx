'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ImprovedBracketRenderer } from '@/components/tournament/bracket-v2/components/ImprovedBracketRenderer'
import { BracketDragDropProvider } from '@/components/tournament/bracket-v2/context/bracket-drag-context'
import { useBracketData } from '@/components/tournament/bracket-v2/hooks/useBracketData'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Info, AlertCircle, Users, Zap } from 'lucide-react'

interface LongBracketViewProps {
  tournamentId: string
  onMatchUpdate?: () => void
}

interface Tournament {
  id: string
  name: string
  type: 'AMERICAN' | 'LONG'
  user_is_owner?: boolean
}

interface TournamentPermissions {
  hasPermission: boolean
  userRole?: string
  source?: 'club_owner' | 'organization_member' | 'admin'
  reason?: string
}

export default function LongBracketView({ tournamentId, onMatchUpdate }: LongBracketViewProps) {

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [permissions, setPermissions] = useState<TournamentPermissions | null>(null)
  const [tournamentLoading, setTournamentLoading] = useState(true)
  const [tournamentError, setTournamentError] = useState<string | null>(null)

  // Cargar datos del torneo directamente (igual que bracket page)
  useEffect(() => {
    if (!tournamentId) return

    const fetchTournament = async () => {
      try {
        const supabase = createClient()

        const [
          { data: tournamentData, error: tournamentError },
          permissionsResponse
        ] = await Promise.all([
          supabase
            .from('tournaments')
            .select('id, name, type, club_id')
            .eq('id', tournamentId)
            .single(),
          fetch(`/api/tournaments/${tournamentId}/permissions`, {
            method: 'GET',
            credentials: 'include'
          })
        ])

        if (tournamentError) throw tournamentError

        if (!permissionsResponse.ok) {
          const errorData = await permissionsResponse.json()
          throw new Error(errorData.error || 'Error verificando permisos')
        }

        const permissionsData: TournamentPermissions = await permissionsResponse.json()

        setTournament({
          id: tournamentData.id,
          name: tournamentData.name,
          type: tournamentData.type as 'AMERICAN' | 'LONG',
          user_is_owner: permissionsData.hasPermission
        })

        setPermissions(permissionsData)

      } catch (error: any) {
        console.error('Error fetching tournament:', error)
        setTournamentError(error.message || 'Error loading tournament')
      } finally {
        setTournamentLoading(false)
      }
    }

    fetchTournament()
  }, [tournamentId])

  const hasManagementPermissions = permissions?.hasPermission || false

  const {
    data: bracketData,
    loading: bracketLoading,
    error,
    refetch
  } = useBracketData(tournamentId, {
    algorithm: 'serpentine',
    config: {
      features: {
        enableDragDrop: hasManagementPermissions,
        enableLiveScoring: hasManagementPermissions,
        showSeeds: true,
        showZoneInfo: true,
        showStatistics: true,
        autoProcessBYEs: true
      }
    },
    enabled: !tournamentLoading && !!tournament && !!permissions
  })

  // Handlers para el bracket
  const handleDataRefresh = () => {
    console.log('Long Bracket - Data refreshed')
    refetch()
  }

  const handleMatchUpdate = (matchId: string, updatedData: any) => {
    console.log('Long Bracket - Match updated:', { matchId, updatedData })
    refetch()
    onMatchUpdate?.()
  }

  // Loading states
  if (tournamentLoading) {
    return <LongBracketSkeleton />
  }

  if (tournamentError) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Error al cargar torneo:</strong> {tournamentError}
        </AlertDescription>
      </Alert>
    )
  }

  if (!tournament) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Torneo no encontrado o no tienes permisos para acceder a él.
        </AlertDescription>
      </Alert>
    )
  }

  if (bracketLoading) {
    return <LongBracketContentSkeleton />
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Error al cargar llave:</strong> {error.message}. Por favor, intenta recargar la página.
        </AlertDescription>
      </Alert>
    )
  }

  if (!bracketData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No hay datos de la llave disponibles. La llave puede no haber sido generada aún.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header informativo */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <Trophy className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Vista de Llave - {tournament.name}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {tournament.type === 'LONG' ? 'Torneo Largo' : 'Torneo Americano'}
                </Badge>
                {hasManagementPermissions && (  
                  <Badge variant="outline">
                    <Trophy className="w-3 h-3 mr-1" />
                    {permissions?.source === 'admin' ? 'Admin' :
                     permissions?.source === 'organization_member' ? 'Organizador' :
                     'Owner'}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              Visualización horizontal tradicional del bracket con funcionalidad completa de drag & drop.
            </p>

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>✅ Funcionalidades disponibles:</strong> Drag & drop para reorganizar parejas •
                Carga de resultados inline • Auto-avance de ganadores • Validación de matches
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      {/* Estadísticas del bracket */}
      <BracketStats bracketData={bracketData} />

      {/* Bracket visualization con toda la funcionalidad */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <BracketDragDropProvider>
          <ImprovedBracketRenderer
            bracketData={bracketData}
            tournamentId={tournamentId}
            tournamentType="LONG"  // ✅ NUEVO - indica que es torneo largo
            isOwner={hasManagementPermissions}
            enableDragDrop={hasManagementPermissions}
            onMatchUpdate={handleMatchUpdate}
            onDataRefresh={handleDataRefresh}
            className="w-full"
          />
        </BracketDragDropProvider>
      </div>

      {/* Info de características */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-slate-700">Drag & Drop</span>
          </div>
          <p className="text-xs text-slate-600">
            Reorganiza parejas arrastrando entre partidos de la misma ronda
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span className="text-sm font-medium text-slate-700">Auto-avance</span>
          </div>
          <p className="text-xs text-slate-600">
            Ganadores avanzan automáticamente a la siguiente ronda
          </p>
        </div>
      </div>
    </div>
  )
}

function BracketStats({ bracketData }: { bracketData: any }) {
  const totalMatches = bracketData.matches?.length || 0
  const completedMatches = bracketData.matches?.filter((m: any) => m.status === 'FINISHED').length || 0
  const pendingMatches = bracketData.matches?.filter((m: any) => m.status === 'PENDING').length || 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Partidos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalMatches}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completados</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{completedMatches}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{pendingMatches}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function LongBracketSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-8">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function LongBracketContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cargando Llave...</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}