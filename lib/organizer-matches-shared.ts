export interface OrganizerMatchesFilters {
  date?: string
  startTime?: string
  endTime?: string
  clubId?: string
  status?: string
  includePast?: boolean
}

export interface OrganizerClubOption {
  id: string
  name: string
}

export interface OrganizerMatchRow {
  matchId: string
  tournamentId: string
  tournamentName: string
  scheduledDate: string
  scheduledStartTime: string | null
  scheduledEndTime: string | null
  courtAssignment: string | null
  round: string | null
  status: string
  matchClubId: string | null
  tournamentClubId: string | null
  effectiveClubId: string | null
  effectiveClubName: string
  couple1Display: string
  couple2Display: string
}

const formatCsvValue = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const escapeCsvValue = (value: string | null | undefined): string => {
  const stringValue = formatCsvValue(value)

  if (
    stringValue.includes('"') ||
    stringValue.includes(";") ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

const normalizeFilterValue = (value?: string | null): string | undefined => {
  if (!value) return undefined

  const normalized = value.trim()
  if (!normalized || normalized === "all") return undefined

  return normalized
}

export const parseOrganizerMatchesFilters = (
  rawFilters: Record<string, string | string[] | undefined>,
): OrganizerMatchesFilters => {
  const getSingleValue = (key: string): string | undefined => {
    const value = rawFilters[key]
    return Array.isArray(value) ? value[0] : value
  }

  return {
    date: normalizeFilterValue(getSingleValue("date")),
    startTime: normalizeFilterValue(getSingleValue("startTime")),
    endTime: normalizeFilterValue(getSingleValue("endTime")),
    clubId: normalizeFilterValue(getSingleValue("clubId")),
    status: normalizeFilterValue(getSingleValue("status")),
    includePast: getSingleValue("includePast") === "true",
  }
}

export const applyOrganizerMatchesFilters = (
  matches: OrganizerMatchRow[],
  filters: OrganizerMatchesFilters,
): OrganizerMatchRow[] => {
  const today = new Date().toLocaleDateString("en-CA")

  return matches.filter((match) => {
    if (!match.scheduledDate) return false

    if (!filters.includePast && match.scheduledDate < today) {
      return false
    }

    if (filters.date && match.scheduledDate !== filters.date) {
      return false
    }

    if (filters.status && match.status !== filters.status) {
      return false
    }

    if (filters.clubId && match.effectiveClubId !== filters.clubId) {
      return false
    }

    if (filters.startTime && match.scheduledStartTime && match.scheduledStartTime < filters.startTime) {
      return false
    }

    if (filters.endTime && match.scheduledStartTime && match.scheduledStartTime > filters.endTime) {
      return false
    }

    return true
  })
}

export const getRoundLabel = (round: string | null): string => {
  if (!round) return "Sin ronda"

  const labels: Record<string, string> = {
    ZONE: "Zona",
    FINAL: "Final",
    SEMIFINAL: "Semifinal",
    "4TOS": "Cuartos",
    "8VOS": "Octavos",
    "16VOS": "16avos",
    "32VOS": "32avos",
  }

  return labels[round] ?? round
}

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: "Programado",
    IN_PROGRESS: "En curso",
    FINISHED: "Finalizado",
    COMPLETED: "Completado",
    DRAFT: "Borrador",
  }

  return labels[status] ?? status
}

export const buildOrganizerMatchesCsv = (matches: OrganizerMatchRow[]): string => {
  const headers = [
    "Fecha",
    "Hora inicio",
    "Hora fin",
    "Club",
    "Cancha",
    "Torneo",
    "Ronda",
    "Estado",
    "Pareja 1",
    "Pareja 2",
    "ID partido",
    "ID torneo",
  ]

  const rows = matches.map((match) => [
    match.scheduledDate,
    match.scheduledStartTime,
    match.scheduledEndTime,
    match.effectiveClubName,
    match.courtAssignment,
    match.tournamentName,
    getRoundLabel(match.round),
    getStatusLabel(match.status),
    match.couple1Display,
    match.couple2Display,
    match.matchId,
    match.tournamentId,
  ])

  const csvLines = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(";")),
  ]

  return "\uFEFF" + csvLines.join("\r\n")
}
