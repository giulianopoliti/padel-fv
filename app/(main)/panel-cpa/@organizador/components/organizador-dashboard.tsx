"use client"

import { Trophy, ArrowRight, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import TournamentCard from "./tournament-card"
import PlayersSectionClient from "./players-section-client"

interface TournamentData {
  id: string
  name: string
  status: string
  pre_tournament_image_url: string | null
  start_date: string
  end_date: string | null
  category_name: string
  gender: string
  type: string
  inscriptions: number
  matchesFinished: number
  matchesPending: number
  totalMatches: number
}

interface PlayerData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string | null
  score: number | null
  profile_image_url: string | null
  category_name: string | null
}

interface Category {
  name: string
  lower_range: number
  upper_range: number | null
}

interface OrganizadorDashboardProps {
  tournaments: TournamentData[]
  players: PlayerData[]
  categories: Category[]
  totalPlayers: number
  organizationId: string
  hasError?: boolean
}

export default function OrganizadorDashboard({
  tournaments,
  players,
  categories,
  totalPlayers,
  organizationId,
  hasError = false
}: OrganizadorDashboardProps) {

  if (hasError) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No pudimos cargar los torneos. Por favor, intenta recargar la página.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Sección: Mis Torneos */}
      <section aria-labelledby="tournaments-heading">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
              <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            </div>
            <div>
              <h2 id="tournaments-heading" className="text-2xl font-bold">
                Mis Torneos
              </h2>
              <p className="text-sm text-muted-foreground">
                Últimos {tournaments.length} torneos activos
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/my-tournaments" className="flex items-center gap-2">
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center py-16 bg-muted/50 rounded-lg border-2 border-dashed">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No tienes torneos todavía
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Comienza creando tu primer torneo de pádel y gestiona inscripciones, partidos y mucho más.
            </p>
            <Button asChild>
              <Link href="/tournaments/create">Crear torneo</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tournaments.map((tournament, index) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                priority={index === 0}
              />
            ))}
          </div>
        )}
      </section>

      <Separator className="my-8" />

      {/* Sección: Mis Jugadores */}
      <section aria-labelledby="players-heading">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-500" aria-hidden="true" />
            </div>
            <div>
              <h2 id="players-heading" className="text-2xl font-bold">
                Mis Jugadores
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalPlayers > 0
                  ? `Mostrando top 10 de ${totalPlayers} jugadores por puntos`
                  : 'No hay jugadores registrados'
                }
              </p>
            </div>
          </div>
          {totalPlayers > 10 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/my-players" className="flex items-center gap-2">
                Ver todos
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>

        <PlayersSectionClient
          initialPlayers={players}
          categories={categories}
          organizationId={organizationId}
          totalPlayers={totalPlayers}
        />
      </section>
    </div>
  )
}
