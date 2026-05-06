'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trophy, Users, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { useUser } from '@/contexts/user-context'
import { getPlayerTournamentMatches, PlayerTournamentData } from '@/utils/player-matches'
import { getPlayerNextMatch, PlayerNextMatch } from '@/app/api/panel-cpa/actions'
import NextMatchCard from './NextMatchCard'
import NextMatchCardEdge from './NextMatchCardEdge'
import MatchHistory from './MatchHistory'
import PublicRegistrationLauncher from '@/components/tournament/public-registration-launcher'
import CancelRegistrationButton from '@/components/tournament/player/cancel-registration-button'
import { Gender } from '@/types'

interface PlayerTournamentDashboardProps {
  tournamentId: string
  tournament: {
    id: string
    name: string
    category?: string
    status?: string
    gender?: Gender
    price?: number | string | null
    enable_transfer_proof?: boolean
    transfer_alias?: string | null
    transfer_amount?: number | null
  }
}

export default function PlayerTournamentDashboard({
  tournamentId,
  tournament
}: PlayerTournamentDashboardProps) {
  const { userDetails } = useUser()
  const [playerData, setPlayerData] = useState<PlayerTournamentData | null>(null)
  const [nextMatchFromEdge, setNextMatchFromEdge] = useState<PlayerNextMatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registrationCancelled, setRegistrationCancelled] = useState(false)

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!userDetails?.player_id) {
        setError('No se pudo obtener información del jugador')
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // 1. Obtener datos generales del torneo (inscripción, historial, etc.)
        const data = await getPlayerTournamentMatches(userDetails.player_id, tournamentId)
        setPlayerData(data)

        // 2. Si está inscripto, obtener próximo partido desde edge function (con club correcto)
        if (data.isRegistered) {
          const { nextMatches } = await getPlayerNextMatch(userDetails.player_id)

          // Filtrar el próximo partido de ESTE torneo específico
          const tournamentNextMatch = nextMatches.find(
            match => match.tournament_id === tournamentId
          )

          if (tournamentNextMatch) {
            setNextMatchFromEdge(tournamentNextMatch)
          }
        }
      } catch (err) {
        console.error('Error fetching player tournament data:', err)
        setError('Error al cargar los datos del torneo')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayerData()
  }, [tournamentId, userDetails?.player_id])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <PlayerDashboardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (registrationCancelled) {
    return (
      <div className="p-6 space-y-6">
        <NotRegisteredView tournamentId={tournamentId} tournament={tournament} />
      </div>
    )
  }

  if (!playerData?.isRegistered) {
    return (
      <div className="p-6 space-y-6">
        <NotRegisteredView tournamentId={tournamentId} tournament={tournament} />
      </div>
    )
  }

  if (playerData?.isEliminated) {
    return (
      <div className="p-6 space-y-6">
        <EliminatedPlayerView
          tournamentId={tournamentId}
          tournament={tournament}
          playerData={playerData}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tournament Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-muted-foreground">
              {tournament.category ? `Categoría ${tournament.category}` : 'Torneo Largo'}
            </p>
          </div>
        </div>
      </div>

      {/* Registration Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Alert className="border-green-200 bg-green-50 sm:flex-1">
        <Users className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>¡Estás inscripto!</strong> Puedes ver tu progreso y próximos partidos.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <CancelRegistrationButton
          tournamentId={tournamentId}
          tournamentName={tournament.name}
          coupleId={playerData.playerCoupleId}
          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 sm:w-auto"
          onCancelled={() => setRegistrationCancelled(true)}
        />
      </div>
      </div>

      {/* Next Match Section */}
      {nextMatchFromEdge ? (
        <NextMatchCardEdge match={nextMatchFromEdge} />
      ) : playerData.nextMatch ? (
        <NextMatchCard
          match={playerData.nextMatch}
          playerCoupleId={playerData.playerCoupleId!}
        />
      ) : (
        <Card className="border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center font-medium">
              No tienes partidos pendientes
            </p>
            <p className="text-gray-400 text-center text-sm">
              Todos tus partidos han sido completados o aún no han sido programados
            </p>
          </CardContent>
        </Card>
      )}

      {/* Match History */}
      <MatchHistory
        zoneMatches={playerData.zoneMatches}
        eliminationMatches={playerData.eliminationMatches}
        playerCoupleId={playerData.playerCoupleId!}
        tournamentId={tournamentId}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos de Zona</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerData.zoneMatches.length}</div>
            <p className="text-xs text-muted-foreground">
              {playerData.zoneMatches.filter(m => m.status === 'FINISHED').length} completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos de Llave</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerData.eliminationMatches.length}</div>
            <p className="text-xs text-muted-foreground">
              {playerData.eliminationMatches.filter(m => m.status === 'FINISHED').length} completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partidos</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {playerData.zoneMatches.length + playerData.eliminationMatches.length}
            </div>
            <p className="text-xs text-muted-foreground">
              En este torneo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NotRegisteredView({
  tournamentId,
  tournament
}: {
  tournamentId: string
  tournament: PlayerTournamentDashboardProps['tournament']
}) {
  return (
    <>
      {/* Tournament Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-muted-foreground">
              {tournament.category ? `Categoría ${tournament.category}` : 'Torneo Largo'}
            </p>
          </div>
        </div>
      </div>

      {/* Not Registered Alert */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>No estás inscripto</strong> en este torneo. Para participar, necesitas registrarte.
        </AlertDescription>
      </Alert>

      {/* Registration Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <UserPlus className="h-5 w-5" />
            ¿Quieres participar?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-800">
            Para unirte a este torneo, abre el formulario de inscripción y completa tu registro.
          </p>

          <PublicRegistrationLauncher
            tournamentId={tournamentId}
            tournamentName={tournament.name}
            tournamentGender={tournament.gender || Gender.MALE}
            tournamentPrice={tournament.price || null}
            enableTransferProof={tournament.enable_transfer_proof || false}
            transferAlias={tournament.transfer_alias || null}
            transferAmount={tournament.transfer_amount || null}
            buttonLabel="Inscribirme"
            buttonClassName="w-full"
          />

          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Recuerda:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Puedes inscribirte individualmente o en pareja</li>
              <li>Necesitas tener tu perfil completo</li>
              <li>Las inscripciones pueden tener fecha límite</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tournament Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Información del Torneo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo:</span>
              <span className="font-medium">Torneo Largo</span>
            </div>
            {tournament.category && (
              <div className="flex justify-between">
                <span className="text-gray-600">Categoría:</span>
                <span className="font-medium">{tournament.category}</span>
              </div>
            )}
            {tournament.status && (
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-medium">{getStatusText(tournament.status)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function PlayerDashboardSkeleton() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-gray-200 p-2 rounded-lg w-10 h-10" />
          <div>
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded mt-2" />
          </div>
        </div>
      </div>

      {/* Loading Cards */}
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando información del torneo...</span>
        </CardContent>
      </Card>
    </>
  )
}

function EliminatedPlayerView({
  tournamentId,
  tournament,
  playerData
}: {
  tournamentId: string
  tournament: PlayerTournamentDashboardProps['tournament']
  playerData: PlayerTournamentData
}) {
  const formatEliminatedDate = (dateString: string | null): string => {
    if (!dateString) return 'Fecha no disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getRoundName = (round: string | null): string => {
    const roundNames: Record<string, string> = {
      'ZONE': 'Fase de Zonas',
      '32VOS': '32vos de Final',
      '16VOS': '16vos de Final',
      '8VOS': 'Octavos de Final',
      '4TOS': 'Cuartos de Final',
      'SEMIFINAL': 'Semifinal',
      'FINAL': 'Final'
    }
    return roundNames[round || ''] || round || 'Ronda no especificada'
  }

  return (
    <>
      {/* Tournament Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-muted-foreground">
              {tournament.category ? `Categoría ${tournament.category}` : 'Torneo Largo'}
            </p>
          </div>
        </div>
      </div>

      {/* Elimination Status */}
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Has sido eliminado del torneo</strong>
          <br />
          <span className="text-sm">
            Eliminado en: <strong>{getRoundName(playerData.eliminatedInRound)}</strong>
            {playerData.eliminatedAt && (
              <> el {formatEliminatedDate(playerData.eliminatedAt)}</>
            )}
          </span>
        </AlertDescription>
      </Alert>

      {/* Tournament Progress Card */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tu Progreso en el Torneo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Llegaste hasta:</h3>
              <p className="text-2xl font-bold text-red-600">
                {getRoundName(playerData.eliminatedInRound)}
              </p>
              {playerData.eliminatedAt && (
                <p className="text-sm text-gray-600 mt-2">
                  {formatEliminatedDate(playerData.eliminatedAt)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match History */}
      <MatchHistory
        zoneMatches={playerData.zoneMatches}
        eliminationMatches={playerData.eliminationMatches}
        playerCoupleId={playerData.playerCoupleId!}
        tournamentId={tournamentId}
      />

      {/* Final Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos de Zona</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerData.zoneMatches.length}</div>
            <p className="text-xs text-muted-foreground">
              {playerData.zoneMatches.filter(m => m.status === 'FINISHED').length} completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos de Llave</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerData.eliminationMatches.length}</div>
            <p className="text-xs text-muted-foreground">
              {playerData.eliminationMatches.filter(m => m.status === 'FINISHED').length} completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partidos</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {playerData.zoneMatches.length + playerData.eliminationMatches.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Jugados en este torneo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Thanks message */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <Trophy className="h-8 w-8 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-blue-900 mb-2">
              ¡Gracias por participar!
            </h3>
            <p className="text-blue-700 text-sm">
              Aunque tu participación en este torneo ha terminado, puedes seguir viendo
              tus estadísticas y el progreso que lograste.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'NOT_STARTED': 'No iniciado',
    'IN_PROGRESS': 'En progreso',
    'ZONE_PHASE': 'Fase de zonas',
    'BRACKET_PHASE': 'Fase de llaves',
    'FINISHED': 'Finalizado',
    'CANCELED': 'Cancelado'
  }

  return statusMap[status] || status
}
