import * as XLSX from "xlsx"
import {
  getRoundLabel,
  getStatusLabel,
  type OrganizerMatchRow,
} from "@/lib/organizer-matches-shared"

const organizerMatchesExcelHeaders = [
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

export const buildOrganizerMatchesXlsx = (matches: OrganizerMatchRow[]): Buffer => {
  const rows = matches.map((match) => [
    match.scheduledDate,
    match.scheduledStartTime ?? "",
    match.scheduledEndTime ?? "",
    match.effectiveClubName,
    match.courtAssignment ?? "",
    match.tournamentName,
    getRoundLabel(match.round),
    getStatusLabel(match.status),
    match.couple1Display,
    match.couple2Display,
    match.tournamentId,
  ])

  const worksheet = XLSX.utils.aoa_to_sheet([organizerMatchesExcelHeaders, ...rows])
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
    { wch: 34 },
    { wch: 34 },
    { wch: 38 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Partidos")

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer
}
