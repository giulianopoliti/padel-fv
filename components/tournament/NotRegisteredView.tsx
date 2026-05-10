'use client'

import React from 'react'
import { Trophy, UserPlus, AlertCircle } from 'lucide-react'

import PublicRegistrationLauncher from '@/components/tournament/public-registration-launcher'
import TournamentPublicInfoCard from '@/components/tournament/TournamentPublicInfoCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TournamentPublicInfo } from '@/lib/tournaments/public-tournament-details'
import { Gender } from '@/types'

interface NotRegisteredViewProps {
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

export default function NotRegisteredView({
  tournamentId,
  tournament
}: NotRegisteredViewProps) {
  return (
    <>
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

      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>No estás inscripto</strong> en este torneo. Para participar, necesitas registrarte.
        </AlertDescription>
      </Alert>

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

      {tournament.publicInfo ? (
        <TournamentPublicInfoCard publicInfo={tournament.publicInfo} showSchedule={false} />
      ) : (
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
      )}
    </>
  )
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    NOT_STARTED: 'No iniciado',
    IN_PROGRESS: 'En progreso',
    ZONE_PHASE: 'Fase de zonas',
    BRACKET_PHASE: 'Fase de llaves',
    FINISHED: 'Finalizado',
    CANCELED: 'Cancelado'
  }

  return statusMap[status] || status
}
