'use client'

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Download, ExternalLink, CalendarDays, Clock3, MapPin, Trophy, History } from "lucide-react"
import MatchFilters, { type MatchFiltersState } from "@/components/matches/match-filters"
import StatusBadge from "@/components/matches/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getRoundLabel } from "@/lib/organizer-matches-shared"

interface OrganizerMatchRow {
  matchId: string
  tournamentId: string
  tournamentName: string
  scheduledDate: string
  scheduledStartTime: string | null
  scheduledEndTime: string | null
  courtAssignment: string | null
  round: string | null
  status: string
  effectiveClubId: string | null
  effectiveClubName: string
  couple1Display: string
  couple2Display: string
}

interface OrganizerClubOption {
  id: string
  name: string
}

interface OrganizerMatchesClientProps {
  matches: OrganizerMatchRow[]
  clubs: OrganizerClubOption[]
  initialFilters: {
    date?: string
    startTime?: string
    endTime?: string
    clubId?: string
    status?: string
    includePast?: boolean
  }
}

const buildFilterState = (filters: OrganizerMatchesClientProps["initialFilters"]): MatchFiltersState => ({
  selectedDate: filters.date ? parseISO(`${filters.date}T12:00:00`) : undefined,
  selectedStatus: filters.status ?? "all",
  startTime: filters.startTime ?? "",
  endTime: filters.endTime ?? "",
  selectedClubId: filters.clubId ?? "all",
})

const formatDateLabel = (value: string): string => {
  try {
    return format(parseISO(`${value}T12:00:00`), "EEEE dd/MM/yyyy", { locale: es })
  } catch {
    return value
  }
}

const formatTimeRange = (startTime: string | null, endTime: string | null): string => {
  if (startTime && endTime) return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`
  if (startTime) return startTime.slice(0, 5)
  return "Sin horario"
}

export default function OrganizerMatchesClient({
  matches,
  clubs,
  initialFilters,
}: OrganizerMatchesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const filters = buildFilterState(initialFilters)

  const syncFiltersToUrl = (nextFilters: MatchFiltersState) => {
    const params = new URLSearchParams()

    if (nextFilters.selectedDate) {
      params.set("date", format(nextFilters.selectedDate, "yyyy-MM-dd"))
    }

    if (nextFilters.startTime) {
      params.set("startTime", nextFilters.startTime)
    }

    if (nextFilters.endTime) {
      params.set("endTime", nextFilters.endTime)
    }

    if (nextFilters.selectedClubId !== "all") {
      params.set("clubId", nextFilters.selectedClubId)
    }

    if (nextFilters.selectedStatus !== "all") {
      params.set("status", nextFilters.selectedStatus)
    }

    if (initialFilters.includePast) {
      params.set("includePast", "true")
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  const exportHref = (() => {
    const params = new URLSearchParams()

    if (initialFilters.date) params.set("date", initialFilters.date)
    if (initialFilters.startTime) params.set("startTime", initialFilters.startTime)
    if (initialFilters.endTime) params.set("endTime", initialFilters.endTime)
    if (initialFilters.clubId) params.set("clubId", initialFilters.clubId)
    if (initialFilters.status) params.set("status", initialFilters.status)
    if (initialFilters.includePast) params.set("includePast", "true")

    const queryString = params.toString()
    return queryString ? `/api/panel/matches/export?${queryString}` : "/api/panel/matches/export"
  })()

  const toggleIncludePast = () => {
    const params = new URLSearchParams()

    if (initialFilters.date) params.set("date", initialFilters.date)
    if (initialFilters.startTime) params.set("startTime", initialFilters.startTime)
    if (initialFilters.endTime) params.set("endTime", initialFilters.endTime)
    if (initialFilters.clubId) params.set("clubId", initialFilters.clubId)
    if (initialFilters.status) params.set("status", initialFilters.status)
    if (!initialFilters.includePast) params.set("includePast", "true")

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            <CalendarDays className="h-4 w-4" />
            Agenda de partidos
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Partidos de mi organización</h1>
            <p className="text-sm text-muted-foreground">
              Filtrá partidos de todos tus torneos por fecha, rango horario y club efectivo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/panel">
              Volver al panel
            </Link>
          </Button>
          <Button asChild>
            <a href={exportHref}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Vista consolidada</CardTitle>
          <CardDescription>
            El club mostrado y filtrado usa el club del partido si existe; si no, hereda el club del torneo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-700">
              {initialFilters.includePast
                ? "Mostrando también partidos históricos."
                : "Mostrando por defecto sólo partidos desde hoy en adelante."}
            </div>
            <Button type="button" variant="outline" onClick={toggleIncludePast}>
              <History className="h-4 w-4" />
              {initialFilters.includePast ? "Ocultar históricos" : "Incluir históricos"}
            </Button>
          </div>

          <MatchFilters
            filters={filters}
            onFiltersChange={syncFiltersToUrl}
            matchCount={matches.length}
            clubes={clubs}
          />

          {matches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <Trophy className="mx-auto mb-4 h-10 w-10 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">No hay partidos para esos filtros</h2>
              <p className="mt-2 text-sm text-slate-600">
                Ajustá fecha, horario o club para encontrar los partidos programados de tu organización.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Cancha</TableHead>
                  <TableHead>Torneo</TableHead>
                  <TableHead>Ronda</TableHead>
                  <TableHead>Pareja 1</TableHead>
                  <TableHead>Pareja 2</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match.matchId}>
                    <TableCell className="font-medium capitalize">
                      {formatDateLabel(match.scheduledDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        <span>{formatTimeRange(match.scheduledStartTime, match.scheduledEndTime)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        <span>{match.effectiveClubName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{match.courtAssignment || "Sin cancha"}</TableCell>
                    <TableCell>
                      <div className="max-w-[220px] truncate font-medium">{match.tournamentName}</div>
                    </TableCell>
                    <TableCell>{getRoundLabel(match.round)}</TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="line-clamp-2">{match.couple1Display}</span>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <span className="line-clamp-2">{match.couple2Display}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={match.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/tournaments/${match.tournamentId}`}>
                          Ver torneo
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
