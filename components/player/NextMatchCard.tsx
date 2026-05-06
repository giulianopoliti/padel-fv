'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, Users, Calendar, Swords } from 'lucide-react'
import { PlayerMatch, getOpponentCoupleName } from '@/utils/player-matches'
import { createClient } from '@/utils/supabase/client'

interface NextMatchCardProps {
  match: PlayerMatch
  playerCoupleId: string
  className?: string
}

export default function NextMatchCard({ match, playerCoupleId, className }: NextMatchCardProps) {
  const [clubAddress, setClubAddress] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string>('')

  useEffect(() => {
    const fetchTournamentData = async () => {
      const supabase = createClient()

      // Get club address
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('clubes:club_id(address)')
        .eq('id', match.tournament_id)
        .single()

      if (tournament?.clubes) {
        setClubAddress((tournament.clubes as any).address)
      }

      // Get partner name
      const isPlayerInCouple1 = match.couple1_id === playerCoupleId
      const playerCouple = isPlayerInCouple1 ? match.couple1 : match.couple2

      if (playerCouple) {
        const { data: couple } = await supabase
          .from('couples')
          .select('player1_id, player2_id')
          .eq('id', playerCoupleId)
          .single()

        if (couple) {
          const partnerId = couple.player1_id === match.couple1?.player1.id || couple.player1_id === match.couple2?.player1.id
            ? couple.player2_id
            : couple.player1_id

          const partnerData = playerCouple.player1.id === partnerId
            ? playerCouple.player1
            : playerCouple.player2

          setPartnerName(`${partnerData.first_name} ${partnerData.last_name}`)
        }
      }
    }

    fetchTournamentData()
  }, [match, playerCoupleId])

  const opponentName = getOpponentCoupleName(match, playerCoupleId)

  // Normalizar fecha_matches
  const fechaMatchesArray = Array.isArray(match.fecha_matches)
    ? match.fecha_matches
    : match.fecha_matches
      ? [match.fecha_matches as any]
      : []

  const fechaMatch = fechaMatchesArray[0]

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <Card className={`border-red-200 bg-gradient-to-br from-red-50 to-pink-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Tu Próximo Partido
          </CardTitle>
          <Badge
            variant="outline"
            className={
              match.status === 'IN_PROGRESS'
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }
          >
            {match.status === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {partnerName && (
          <div className="flex items-center text-sm">
            <Users className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Compañero:</span>
            <span className="ml-2 font-medium text-gray-900">{partnerName}</span>
          </div>
        )}

        <div className="flex items-center text-sm">
          <Swords className="mr-2 h-4 w-4 text-gray-500" />
          <span className="text-gray-600">Rivales:</span>
          <span className="ml-2 font-medium text-gray-900">{opponentName}</span>
        </div>

        {fechaMatch?.scheduled_date && (
          <div className="flex items-center text-sm">
            <Calendar className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Fecha:</span>
            <span className="ml-2 font-medium text-gray-900">
              {formatDate(fechaMatch.scheduled_date)}
            </span>
          </div>
        )}

        {fechaMatch?.scheduled_start_time && (
          <div className="flex items-center text-sm">
            <Clock className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Hora:</span>
            <span className="ml-2 font-medium text-gray-900">
              {fechaMatch.scheduled_start_time.slice(0, 5)}
            </span>
          </div>
        )}

        {fechaMatch?.court_assignment && (
          <div className="flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Cancha:</span>
            <span className="ml-2 font-medium text-gray-900">
              {fechaMatch.court_assignment}
            </span>
          </div>
        )}

        {clubAddress && (
          <div className="flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Dirección:</span>
            <span className="ml-2 font-medium text-gray-900">
              {clubAddress}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}