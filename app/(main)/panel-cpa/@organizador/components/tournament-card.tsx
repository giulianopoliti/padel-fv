"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Button } from "@/components/ui/button"
import { Users, Zap, Calendar, Trophy, Clock, MapPin, Award } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface TournamentCardProps {
  tournament: {
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
    is_draft?: boolean
  }
  priority?: boolean
}

const getTournamentStatusConfig = (status: string) => {
  const configs: Record<string, { badge: string; accent: string; label: string; icon?: string }> = {
    NOT_STARTED: {
      badge: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
      accent: "border-l-gray-400",
      label: "No iniciado",
      icon: "⏸️"
    },
    ZONE_REGISTRATION: {
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
      accent: "border-l-blue-500",
      label: "Registro abierto",
      icon: "📝"
    },
    IN_PROGRESS: {
      badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
      accent: "border-l-blue-500",
      label: "En progreso",
      icon: "▶️"
    },
    ZONE_PHASE: {
      badge: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400",
      accent: "border-l-cyan-500",
      label: "Fase de zonas",
      icon: "🎯"
    },
    BRACKET_PHASE: {
      badge: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400",
      accent: "border-l-purple-500",
      label: "Fase de llaves",
      icon: "🏆"
    },
    FINISHED: {
      badge: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
      accent: "border-l-green-500",
      label: "Finalizado",
      icon: "✅"
    },
    FINISHED_POINTS_CALCULATED: {
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
      accent: "border-l-emerald-500",
      label: "Completado",
      icon: "✨"
    },
    CANCELED: {
      badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
      accent: "border-l-red-500",
      label: "Cancelado",
      icon: "❌"
    }
  }
  return configs[status] || configs.NOT_STARTED
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const getGenderLabel = (gender: string) => {
  const labels: Record<string, string> = {
    MALE: "Masculino",
    FEMALE: "Femenino",
    MIXED: "Mixto",
    SHEMALE: "Mixto"
  }
  return labels[gender] || gender
}

const getTournamentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    LONG: "Largo",
    AMERICAN: "Americano",
    AMERICAN_OTP: "Americano OTP"
  }
  return labels[type] || type
}

export default function TournamentCard({ tournament, priority = false }: TournamentCardProps) {
  const statusConfig = getTournamentStatusConfig(tournament.status)
  const progressPercentage = tournament.totalMatches > 0
    ? Math.round((tournament.matchesFinished / tournament.totalMatches) * 100)
    : 0

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <Link
          href={`/tournaments/${tournament.id}`}
          className="block group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
          aria-label={`Ver detalles del torneo ${tournament.name}, estado: ${statusConfig.label}`}
        >
          <Card className={`hover:shadow-lg transition-all duration-200 border-l-4 ${statusConfig.accent} overflow-hidden`}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row gap-0">
                {/* Imagen - Desktop: lado izquierdo, Mobile: arriba */}
                <div className="relative w-full md:w-64 md:min-h-[180px] flex-shrink-0">
                  <AspectRatio ratio={16 / 9} className="bg-muted">
                    {tournament.pre_tournament_image_url ? (
                      <Image
                        src={tournament.pre_tournament_image_url}
                        alt={`Imagen del torneo ${tournament.name}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 256px"
                        priority={priority}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
                        <Trophy className="h-16 w-16 text-white opacity-40" aria-hidden="true" />
                      </div>
                    )}
                  </AspectRatio>
                  {/* Badge flotante en la imagen */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg">
                      {statusConfig.icon} {statusConfig.label}
                    </Badge>
                    {tournament.is_draft && (
                      <Badge className="bg-amber-500 text-white shadow-lg text-xs">
                        BORRADOR
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Contenido */}
                <div className="flex-1 p-5 md:p-6 space-y-4">
                  {/* Header */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {tournament.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" aria-hidden="true" />
                        {tournament.category_name}
                      </span>
                      <span>•</span>
                      <span>{getGenderLabel(tournament.gender)}</span>
                      <span>•</span>
                      <span>{getTournamentTypeLabel(tournament.type)}</span>
                    </div>
                  </div>

                  {/* Métricas principales */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" aria-hidden="true" />
                      <span className="text-2xl font-bold">{tournament.inscriptions}</span>
                      <span className="text-xs text-muted-foreground">inscriptos</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <Zap className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" aria-hidden="true" />
                      <span className="text-2xl font-bold">{tournament.matchesFinished}</span>
                      <span className="text-xs text-muted-foreground">finalizados</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400 mb-1" aria-hidden="true" />
                      <span className="text-2xl font-bold">{tournament.matchesPending}</span>
                      <span className="text-xs text-muted-foreground">programados</span>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  {tournament.totalMatches > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progreso del torneo</span>
                        <span className="font-medium">{progressPercentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                          role="progressbar"
                          aria-valuenow={progressPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </HoverCardTrigger>

      {/* Hover Card - Info expandida */}
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1">{tournament.name}</h4>
            <Badge variant="outline" className={statusConfig.badge}>
              {statusConfig.label}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Inicio: {formatDate(tournament.start_date)}</span>
            </div>
            {tournament.end_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Fin: {formatDate(tournament.end_date)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Categoría {tournament.category_name} • {getGenderLabel(tournament.gender)}</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Total partidos</p>
              <p className="font-semibold text-base">{tournament.totalMatches}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Progreso</p>
              <p className="font-semibold text-base">{progressPercentage}%</p>
            </div>
          </div>

          <Button size="sm" className="w-full" asChild>
            <Link href={`/tournaments/${tournament.id}`}>
              Ver detalles completos →
            </Link>
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
