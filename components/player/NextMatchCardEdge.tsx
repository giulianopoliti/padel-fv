'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin, Users, Calendar, Swords } from 'lucide-react'
import { PlayerNextMatch } from '@/app/api/panel-cpa/actions'

interface NextMatchCardEdgeProps {
  match: PlayerNextMatch
  className?: string
}

/**
 * Componente para mostrar próximo partido usando datos de edge function
 * Ventaja: Ya trae el club correcto (match.club_id priorizado sobre tournament.club_id)
 */
export default function NextMatchCardEdge({ match, className }: NextMatchCardEdgeProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatRound = (round?: string) => {
    if (!round) return null
    const roundNames: Record<string, string> = {
      'ZONE': 'Zona',
      '32VOS': '32vos',
      '16VOS': '16vos',
      '8VOS': 'Octavos',
      '4TOS': 'Cuartos',
      'SEMIFINAL': 'Semifinal',
      'FINAL': 'Final'
    }
    return roundNames[round] || round
  }

  return (
    <Card className={`border-red-200 bg-gradient-to-br from-red-50 to-pink-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Tu Próximo Partido
          </CardTitle>
          <div className="flex gap-2">
            {match.round && (
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200"
              >
                {formatRound(match.round)}
              </Badge>
            )}
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {match.partner_name && (
          <div className="flex items-center text-sm">
            <Users className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Compañero:</span>
            <span className="ml-2 font-medium text-gray-900">{match.partner_name}</span>
          </div>
        )}

        <div className="flex items-center text-sm">
          <Swords className="mr-2 h-4 w-4 text-gray-500" />
          <span className="text-gray-600">Rivales:</span>
          <span className="ml-2 font-medium text-gray-900">
            {match.opponent_names.join(' / ')}
          </span>
        </div>

        {match.scheduled_info.date && (
          <div className="flex items-center text-sm">
            <Calendar className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Fecha:</span>
            <span className="ml-2 font-medium text-gray-900">
              {formatDate(match.scheduled_info.date)}
            </span>
          </div>
        )}

        {match.scheduled_info.time && (
          <div className="flex items-center text-sm">
            <Clock className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Hora:</span>
            <span className="ml-2 font-medium text-gray-900">
              {match.scheduled_info.time.slice(0, 5)}
            </span>
          </div>
        )}

        {match.scheduled_info.court && (
          <div className="flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Cancha:</span>
            <span className="ml-2 font-medium text-gray-900">
              {match.scheduled_info.court}
            </span>
          </div>
        )}

        {match.club_name && (
          <div className="flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Club:</span>
            <span className="ml-2 font-medium text-gray-900">
              {match.club_name}
            </span>
          </div>
        )}

        {match.club_address && (
          <div className="flex items-center text-sm">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Dirección:</span>
            <span className="ml-2 font-medium text-gray-900">
              {match.club_address}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
