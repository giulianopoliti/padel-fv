'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Trophy, Zap, Clock, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { PlayerMatch, getOpponentCoupleName, formatMatchSchedule, getRoundDisplayName, didPlayerWin } from '@/utils/player-matches'
import ThreeSetResultDisplay from '@/components/tournament/universal/ThreeSetResultDisplay'

interface MatchHistoryProps {
  zoneMatches: PlayerMatch[]
  eliminationMatches: PlayerMatch[]
  playerCoupleId: string
  tournamentId: string
  className?: string
}

export default function MatchHistory({
  zoneMatches,
  eliminationMatches,
  playerCoupleId,
  tournamentId,
  className
}: MatchHistoryProps) {
  const totalMatches = zoneMatches.length + eliminationMatches.length

  if (totalMatches === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            No hay partidos registrados aún
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Historial de Partidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="zone" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zone" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Partidos de Qually ({zoneMatches.length})
            </TabsTrigger>
            <TabsTrigger value="elimination" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Partidos de Llave ({eliminationMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zone" className="mt-4">
            <ZoneMatchesList
              matches={zoneMatches}
              playerCoupleId={playerCoupleId}
              tournamentId={tournamentId}
            />
          </TabsContent>

          <TabsContent value="elimination" className="mt-4">
            <EliminationMatchesList
              matches={eliminationMatches}
              playerCoupleId={playerCoupleId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

interface MatchesListProps {
  matches: PlayerMatch[]
  playerCoupleId: string
  tournamentId?: string
}

function ZoneMatchesList({ matches, playerCoupleId, tournamentId }: MatchesListProps) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <Zap className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">No hay partidos de zona aún</p>
      </div>
    )
  }

  // Agrupar por zona para mejor organización
  const matchesByZone = matches.reduce((acc, match) => {
    const zoneId = match.zone_id || 'sin-zona'
    if (!acc[zoneId]) acc[zoneId] = []
    acc[zoneId].push(match)
    return acc
  }, {} as Record<string, PlayerMatch[]>)

  return (
    <div className="space-y-4">
      {Object.entries(matchesByZone).map(([zoneId, zoneMatches]) => (
        <div key={zoneId} className="space-y-3">
          {tournamentId && zoneId !== 'sin-zona' && (
            <div className="flex items-center justify-end">
              <Link
                href={`/tournaments/${tournamentId}/zone-matches/${zoneId}`}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
              >
                Ver todos los partidos
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {zoneMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              playerCoupleId={playerCoupleId}
              showZoneLink={false}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function EliminationMatchesList({ matches, playerCoupleId }: MatchesListProps) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">No hay partidos de llave aún</p>
      </div>
    )
  }

  // Ordenar por ronda (del más reciente al más antiguo)
  const roundOrder = ['FINAL', 'SEMIFINAL', '4TOS', '8VOS', '16VOS', '32VOS']
  const sortedMatches = matches.sort((a, b) => {
    const aIndex = roundOrder.indexOf(a.round)
    const bIndex = roundOrder.indexOf(b.round)
    return aIndex - bIndex
  })

  return (
    <div className="space-y-3">
      {sortedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          playerCoupleId={playerCoupleId}
          showZoneLink={false}
        />
      ))}
    </div>
  )
}

interface MatchCardProps {
  match: PlayerMatch
  playerCoupleId: string
  showZoneLink?: boolean
}

function MatchCard({ match, playerCoupleId, showZoneLink = true }: MatchCardProps) {
  const opponentName = getOpponentCoupleName(match, playerCoupleId)
  const scheduleInfo = formatMatchSchedule(match)
  const roundName = getRoundDisplayName(match.round)
  const playerWon = didPlayerWin(match, playerCoupleId)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FINISHED':
        return playerWon ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = () => {
    if (match.status === 'FINISHED') {
      return playerWon ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )
    }
    return <Clock className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (match.status === 'FINISHED') {
      return playerWon ? 'Ganado' : 'Perdido'
    }
    switch (match.status) {
      case 'IN_PROGRESS':
        return 'En Curso'
      case 'PENDING':
        return 'Pendiente'
      default:
        return match.status
    }
  }

  return (
    <Card className="border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(match.status) + ' text-xs flex items-center gap-1'}>
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(match.created_at).toLocaleDateString('es-ES')}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-600">vs </span>
            <span className="font-medium text-gray-900">{opponentName}</span>
          </div>

          <div className="text-sm text-gray-600">
            {scheduleInfo}
          </div>

          {/* Mostrar resultado si el partido está terminado */}
          {match.status === 'FINISHED' && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <ThreeSetResultDisplay matchId={match.id} className="text-sm" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}