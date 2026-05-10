'use client'

import React, { useState, useEffect } from 'react'
import { Trophy, Users, AlertCircle, Loader2 } from 'lucide-react'

import { getPlayerNextMatch, PlayerNextMatch } from '@/app/api/panel/actions'
import NextMatchCardEdge from '@/components/player/NextMatchCardEdge'
import CancelRegistrationButton from '@/components/tournament/player/cancel-registration-button'
import NotRegisteredView from '@/components/tournament/NotRegisteredView'
import TournamentPublicInfoCard from '@/components/tournament/TournamentPublicInfoCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUser } from '@/contexts/user-context'
import type { TournamentPublicInfo } from '@/lib/tournaments/public-tournament-details'
import { Gender } from '@/types'
import { getPlayerTournamentMatches, PlayerTournamentData } from '@/utils/player-matches'

import MatchHistory from './MatchHistory'
import NextMatchCard from './NextMatchCard'

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
    publicInfo?: TournamentPublicInfo
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

        const data = await getPlayerTournamentMatches(userDetails.player_id, tournamentId)
        setPlayerData(data)

        if (data.isRegistered) {
          const { nextMatches } = await getPlayerNextMatch(userDetails.player_id)
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

  if (registrationCancelled || !playerData?.isRegistered) {
    return (
      <div className="p-6 space-y-6">
        <NotRegisteredView tournamentId={tournamentId} tournament={tournament} />
      </div>
    )
  }

  if (playerData.isEliminated) {
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

      {tournament.publicInfo && (
        <TournamentPublicInfoCard publicInfo={tournament.publicInfo} showSchedule={false} />
      )}

      <MatchHistory
        zoneMatches={playerData.zoneMatches}
        eliminationMatches={playerData.eliminationMatches}
        playerCoupleId={playerData.playerCoupleId!}
        tournamentId={tournamentId}
      />

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

function PlayerDashboardSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-gray-200 p-2 rounded-lg w-10 h-10" />
          <div>
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded mt-2" />
          </div>
        </div>
      </div>

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
      ZONE: 'Fase de Zonas',
      '32VOS': '32vos de Final',
      '16VOS': '16vos de Final',
      '8VOS': 'Octavos de Final',
      '4TOS': 'Cuartos de Final',
      SEMIFINAL: 'Semifinal',
      FINAL: 'Final'
    }
    return roundNames[round || ''] || round || 'Ronda no especificada'
  }

  return (
    <>
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

      {tournament.publicInfo && (
        <TournamentPublicInfoCard publicInfo={tournament.publicInfo} showSchedule={false} />
      )}

      <MatchHistory
        zoneMatches={playerData.zoneMatches}
        eliminationMatches={playerData.eliminationMatches}
        playerCoupleId={playerData.playerCoupleId!}
        tournamentId={tournamentId}
      />

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
    </>
  )
}
