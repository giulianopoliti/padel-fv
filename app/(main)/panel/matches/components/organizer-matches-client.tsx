'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Download, ExternalLink, CalendarDays, Clock3, MapPin, Trophy, History } from "lucide-react"
import OrganizerMatchFilters, {
  type OrganizerMatchFiltersState,
} from "@/app/(main)/panel/matches/components/organizer-match-filters"
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
import {
  getDefaultOrganizerMatchesFilters,
  getRoundLabel,
} from "@/lib/organizer-matches-shared"

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
    fromDate: string
    fromTime: string
    toDate: string
    toTime: string
    clubId?: string
    status?: string
    includePast?: boolean
  }
  currentPage: number
  totalPages: number
  totalCount: number
}

const defaultOrganizerFilters = getDefaultOrganizerMatchesFilters()

const buildFilterState = (
  filters: OrganizerMatchesClientProps["initialFilters"],
): OrganizerMatchFiltersState => ({
  fromDate: filters.fromDate,
  fromTime: filters.fromTime,
  toDate: filters.toDate,
  toTime: filters.toTime,
  selectedStatus: filters.status ?? "all",
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
  currentPage,
  totalPages,
  totalCount,
}: OrganizerMatchesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState(() => buildFilterState(initialFilters))
  const [currentIncludePast, setCurrentIncludePast] = useState(Boolean(initialFilters.includePast))
  const defaultFilterState = buildFilterState(defaultOrganizerFilters)

  useEffect(() => {
    setFilters(buildFilterState(initialFilters))
    setCurrentIncludePast(Boolean(initialFilters.includePast))
  }, [
    initialFilters.fromDate,
    initialFilters.fromTime,
    initialFilters.toDate,
    initialFilters.toTime,
    initialFilters.clubId,
    initialFilters.status,
    initialFilters.includePast,
  ])

  const buildUrlSearchParams = ({
    nextFilters = filters,
    includePast = currentIncludePast,
    page,
  }: {
    nextFilters?: OrganizerMatchFiltersState
    includePast?: boolean
    page?: number
  } = {}) => {
    const params = new URLSearchParams(searchParams.toString())

    params.set("fromDate", nextFilters.fromDate)
    params.set("fromTime", nextFilters.fromTime)
    params.set("toDate", nextFilters.toDate)
    params.set("toTime", nextFilters.toTime)

    if (nextFilters.selectedClubId !== "all") {
      params.set("clubId", nextFilters.selectedClubId)
    } else {
      params.delete("clubId")
    }

    if (nextFilters.selectedStatus !== "all") {
      params.set("status", nextFilters.selectedStatus)
    } else {
      params.delete("status")
    }

    if (includePast) {
      params.set("includePast", "true")
    } else {
      params.delete("includePast")
    }

    if (page && page > 1) {
      params.set("page", String(page))
    } else {
      params.delete("page")
    }

    return params
  }

  const syncFiltersToUrl = (nextFilters: OrganizerMatchFiltersState) => {
    setFilters(nextFilters)
    const params = buildUrlSearchParams({ nextFilters })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    router.refresh()
  }

  const exportHref = (() => {
    const params = new URLSearchParams()

    params.set("fromDate", filters.fromDate)
    params.set("fromTime", filters.fromTime)
    params.set("toDate", filters.toDate)
    params.set("toTime", filters.toTime)
    if (filters.selectedClubId !== "all") params.set("clubId", filters.selectedClubId)
    if (filters.selectedStatus !== "all") params.set("status", filters.selectedStatus)
    if (currentIncludePast) params.set("includePast", "true")

    return `/api/panel/matches/export?${params.toString()}`
  })()

  const toggleIncludePast = () => {
    const nextIncludePast = !currentIncludePast
    setCurrentIncludePast(nextIncludePast)
    const params = buildUrlSearchParams({ includePast: nextIncludePast })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    router.refresh()
  }

  const navigateToPage = (page: number) => {
    const params = buildUrlSearchParams({ page })
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    router.refresh()
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
            <h1 className="text-3xl font-bold tracking-tight">Partidos de mi organizacion</h1>
            <p className="text-sm text-muted-foreground">
              Filtra partidos de todos tus torneos por rango de fecha y horario, estado y club efectivo.
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
              Exportar Excel
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
              {currentIncludePast
                ? "Mostrando tambien partidos historicos dentro del rango elegido."
                : "Mostrando solo partidos desde hoy en adelante dentro del rango elegido."}
            </div>
            <Button type="button" variant="outline" onClick={toggleIncludePast}>
              <History className="h-4 w-4" />
              {currentIncludePast ? "Ocultar historicos" : "Incluir historicos"}
            </Button>
          </div>

          <OrganizerMatchFilters
            filters={filters}
            defaultFilters={defaultFilterState}
            onFiltersChange={syncFiltersToUrl}
            matchCount={totalCount}
            clubes={clubs}
          />

          {matches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <Trophy className="mx-auto mb-4 h-10 w-10 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">No hay partidos para esos filtros</h2>
              <p className="mt-2 text-sm text-slate-600">
                Ajusta el rango, estado o club para encontrar los partidos programados de tu organizacion.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Pagina {currentPage} de {totalPages}. Mostrando {matches.length} partidos en esta pagina, {totalCount} en total.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => navigateToPage(currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => navigateToPage(currentPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
