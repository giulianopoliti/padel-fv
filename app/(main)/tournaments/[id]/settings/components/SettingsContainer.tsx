"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Settings2, Users, FileText, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import QualifyingAdvancementForm from './QualifyingAdvancementForm'
import RegistrationControlForm from './RegistrationControlForm'
import TournamentBasicInfoForm from './TournamentBasicInfoForm'
import TournamentImageSection from './TournamentImageSection'

interface SettingsContainerProps {
  tournament: {
    id: string
    name: string
    description?: string | null
    max_participants?: number | null
    category_name?: string
    type: string
    status?: string
    registration_locked?: boolean
    bracket_status?: string
    pre_tournament_image_url?: string | null
    clubes?: {
      cover_image_url?: string | null
    } | null
  }
  rankingConfig: any
  inscriptionsCount: number
}

export default function SettingsContainer({
  tournament,
  rankingConfig,
  inscriptionsCount
}: SettingsContainerProps) {
  return (
    <>
      {/* Header con información del torneo */}
      <div className="text-center space-y-2 mb-8">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="h-5 w-5" />
          <span className="text-sm font-medium">Configuración del Torneo</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{tournament.name}</h2>
        {tournament.category_name && (
          <p className="text-sm text-muted-foreground">{tournament.category_name}</p>
        )}
      </div>

      {/* Información Básica */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">Información Básica</CardTitle>
              <CardDescription className="text-sm">
                Edita el nombre, descripción y capacidad del torneo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TournamentBasicInfoForm
            tournamentId={tournament.id}
            initialData={{
              name: tournament.name,
              description: tournament.description,
              max_participants: tournament.max_participants
            }}
            inscriptionsCount={inscriptionsCount}
          />
        </CardContent>
      </Card>

      {/* Imagen de Portada */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <ImageIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">Imagen de Portada</CardTitle>
              <CardDescription className="text-sm">
                Sube una imagen promocional para el torneo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TournamentImageSection tournament={tournament} />
        </CardContent>
      </Card>

      {/* Quick action para torneos LONG */}
      {tournament.type === 'LONG' && (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 mb-6">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Generar Llave</h3>
                <p className="text-sm text-muted-foreground">
                  Administra y genera la llave de eliminación directa
                </p>
              </div>
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/tournaments/${tournament.id}/bracket`}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Ir a la Llave
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control de Inscripciones */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">Control de Inscripciones</CardTitle>
              <CardDescription className="text-sm">
                Administra el acceso de nuevas inscripciones al torneo
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RegistrationControlForm
            tournamentId={tournament.id}
            initialRegistrationLocked={tournament.registration_locked || false}
            initialBracketStatus={tournament.bracket_status || "NOT_STARTED"}
            currentStatus={tournament.status || "NOT_STARTED"}
          />
        </CardContent>
      </Card>

      {/* Configuración de Avance */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">Configuración de Avance</CardTitle>
              <CardDescription className="text-sm">
                Define cuántas parejas avanzan de la fase clasificatoria
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <QualifyingAdvancementForm
            tournamentId={tournament.id}
            rankingConfig={rankingConfig}
          />
        </CardContent>
      </Card>
    </>
  )
}