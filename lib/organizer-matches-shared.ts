export interface OrganizerMatchesFilters {
  fromDate: string
  fromTime: string
  toDate: string
  toTime: string
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
  tournamentType?: string | null
  tournamentStatus?: string | null
  scheduledDate: string
  scheduledStartTime: string | null
  scheduledEndTime: string | null
  courtAssignment: string | null
  round: string | null
  status: string
  couple1Id?: string | null
  couple2Id?: string | null
  winnerId?: string | null
  resultCouple1?: string | null
  resultCouple2?: string | null
  matchClubId: string | null
  tournamentClubId: string | null
  effectiveClubId: string | null
  effectiveClubName: string
  couple1Display: string
  couple2Display: string
  couple1?: OrganizerMatchCouple | null
  couple2?: OrganizerMatchCouple | null
}

export interface OrganizerMatchPlayer {
  first_name: string
  last_name: string
}

export interface OrganizerMatchCouple {
  player1: OrganizerMatchPlayer
  player2: OrganizerMatchPlayer
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

const getTodayDate = (): string => new Date().toLocaleDateString("en-CA")

export const getDefaultOrganizerMatchesFilters = (): OrganizerMatchesFilters => {
  const today = getTodayDate()

  return {
    fromDate: today,
    fromTime: "00:00",
    toDate: today,
    toTime: "23:59",
    includePast: false,
  }
}

const normalizeTimeValue = (value?: string | null, fallback = "00:00"): string => {
  const normalized = normalizeFilterValue(value)
  if (!normalized) return fallback

  return normalized.length >= 5 ? normalized.slice(0, 5) : normalized
}

const buildComparableDateTime = (date: string, time: string): string => `${date}T${time.slice(0, 5)}`

const getMatchComparableDateTime = (match: OrganizerMatchRow): string | null => {
  if (!match.scheduledDate || !match.scheduledStartTime) return null
  return buildComparableDateTime(match.scheduledDate, match.scheduledStartTime)
}

const resolveOrganizerMatchesFilters = (
  filters: Partial<OrganizerMatchesFilters>,
): OrganizerMatchesFilters => ({
  ...getDefaultOrganizerMatchesFilters(),
  ...filters,
})

export const isOrganizerMatchesRangeInvalid = (filters: Partial<OrganizerMatchesFilters>): boolean => {
  const resolvedFilters = resolveOrganizerMatchesFilters(filters)

  return buildComparableDateTime(resolvedFilters.fromDate, resolvedFilters.fromTime) >
    buildComparableDateTime(resolvedFilters.toDate, resolvedFilters.toTime)
}

export const parseOrganizerMatchesFilters = (
  rawFilters: Record<string, string | string[] | undefined>,
): OrganizerMatchesFilters => {
  const getSingleValue = (key: string): string | undefined => {
    const value = rawFilters[key]
    return Array.isArray(value) ? value[0] : value
  }

  const defaults = getDefaultOrganizerMatchesFilters()

  return {
    fromDate: normalizeFilterValue(getSingleValue("fromDate")) ?? defaults.fromDate,
    fromTime: normalizeTimeValue(getSingleValue("fromTime"), defaults.fromTime),
    toDate: normalizeFilterValue(getSingleValue("toDate")) ?? defaults.toDate,
    toTime: normalizeTimeValue(getSingleValue("toTime"), defaults.toTime),
    clubId: normalizeFilterValue(getSingleValue("clubId")),
    status: normalizeFilterValue(getSingleValue("status")),
    includePast: getSingleValue("includePast") === "true",
  }
}

export const applyOrganizerMatchesFilters = (
  matches: OrganizerMatchRow[],
  rawFilters: Partial<OrganizerMatchesFilters>,
): OrganizerMatchRow[] => {
  const filters = resolveOrganizerMatchesFilters(rawFilters)
  const today = getTodayDate()
  const fromDateTime = buildComparableDateTime(filters.fromDate, filters.fromTime)
  const toDateTime = buildComparableDateTime(filters.toDate, filters.toTime)

  if (fromDateTime > toDateTime) {
    return []
  }

  return matches.filter((match) => {
    if (!match.scheduledDate) return false
    if (!match.scheduledStartTime) return false

    if (!filters.includePast && match.scheduledDate < today) {
      return false
    }

    const matchDateTime = getMatchComparableDateTime(match)
    if (!matchDateTime) {
      return false
    }

    if (filters.status && match.status !== filters.status) {
      return false
    }

    if (filters.clubId && match.effectiveClubId !== filters.clubId) {
      return false
    }

    if (matchDateTime < fromDateTime) {
      return false
    }

    if (matchDateTime > toDateTime) {
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
    match.tournamentId,
  ])

  const csvLines = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(";")),
  ]

  return "\uFEFF" + csvLines.join("\r\n")
}
