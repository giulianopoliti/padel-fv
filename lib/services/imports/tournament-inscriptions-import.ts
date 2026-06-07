import * as XLSX from "xlsx"

import { normalizePlayerDni, sanitizeDniInput } from "@/lib/utils/player-dni"
import { normalizePlayerNamePart } from "@/lib/utils/player-identity"
import type { IdentityCandidate } from "@/lib/services/player-identity-service"

export type ImportPlayerSlot = "player1" | "player2"
export type ImportDecisionAction = "use" | "create" | "skip"

export interface ParsedImportPlayer {
  fullName: string
  firstName: string
  lastName: string
  dni: string | null
  gender: "MALE" | "FEMALE"
  warnings: string[]
}

export interface PreviewImportPlayer extends ParsedImportPlayer {
  candidates: IdentityCandidate[]
  primaryCandidate: IdentityCandidate | null
  hasStrongMatch: boolean
}

export interface ParsedImportRow {
  id: string
  rowNumber: number
  player1: ParsedImportPlayer | null
  player2: ParsedImportPlayer | null
  rowType: "couple" | "individual" | "empty" | "invalid"
  warnings: string[]
}

export interface PreviewImportRow extends Omit<ParsedImportRow, "player1" | "player2"> {
  player1: PreviewImportPlayer | null
  player2: PreviewImportPlayer | null
}

export interface ImportPlayerDecision {
  action: ImportDecisionAction
  playerId?: string
}

export interface ImportRowDecision {
  player1?: ImportPlayerDecision
  player2?: ImportPlayerDecision
}

export interface CommitImportRow extends ParsedImportRow {
  decisions?: ImportRowDecision
}

export interface ParsedWorkbook {
  sheetNames: string[]
  selectedSheetName: string | null
  rows: ParsedImportRow[]
}

const PLACEHOLDER_NAME_PATTERN = /^(x+|n\/a|na|sin\s+pareja|a\s+definir|pendiente|-+)$/i

const COMMON_COMPOUND_FIRST_NAMES = new Set([
  "ana maria",
  "ana laura",
  "ana liz",
  "juan pablo",
  "juan carlos",
  "juan manuel",
  "jose maria",
  "jose luis",
  "maria jose",
  "maria laura",
  "maria sol",
  "maría jose",
  "maría laura",
  "maría sol",
])

export const cleanCellText = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

export const isPlaceholderName = (value: string): boolean => {
  const normalized = normalizePlayerNamePart(value)
  return !normalized || PLACEHOLDER_NAME_PATTERN.test(normalized)
}

export const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const normalized = cleanCellText(fullName)
  const parts = normalized.split(" ").filter(Boolean)

  if (parts.length === 0) {
    return { firstName: "", lastName: "" }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" }
  }

  const firstTwo = normalizePlayerNamePart(parts.slice(0, 2).join(" "))
  if (parts.length >= 3 && COMMON_COMPOUND_FIRST_NAMES.has(firstTwo)) {
    return {
      firstName: parts.slice(0, 2).join(" "),
      lastName: parts.slice(2).join(" "),
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export const getDefaultGenderForSlot = (
  tournamentGender: string | null | undefined,
  slot: ImportPlayerSlot,
): "MALE" | "FEMALE" => {
  const normalized = (tournamentGender || "").toUpperCase()

  if (normalized === "FEMALE") return "FEMALE"
  if (normalized === "MIXED") return slot === "player1" ? "MALE" : "FEMALE"

  return "MALE"
}

export const parseImportPlayer = (
  fullNameCell: unknown,
  dniCell: unknown,
  tournamentGender: string | null | undefined,
  slot: ImportPlayerSlot,
): ParsedImportPlayer | null => {
  const fullName = cleanCellText(fullNameCell)

  if (!fullName || isPlaceholderName(fullName)) {
    return null
  }

  const { firstName, lastName } = splitFullName(fullName)
  const normalizedDni = normalizePlayerDni(cleanCellText(dniCell))
  const warnings: string[] = []

  if (!lastName) {
    warnings.push("Se importara sin apellido.")
  }

  if (!normalizedDni.dni && cleanCellText(dniCell)) {
    warnings.push("El DNI informado no tiene numeros validos.")
  }

  return {
    fullName,
    firstName,
    lastName,
    dni: normalizedDni.dni,
    gender: getDefaultGenderForSlot(tournamentGender, slot),
    warnings,
  }
}

const isHeaderRow = (row: unknown[]): boolean => {
  const joined = row.map(cleanCellText).join(" ").toLowerCase()
  return joined.includes("nombre") && joined.includes("dni")
}

export const parseWorkbookBuffer = (
  buffer: Buffer,
  options: {
    sheetName?: string | null
    tournamentGender?: string | null
  } = {},
): ParsedWorkbook => {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetNames = workbook.SheetNames
  const selectedSheetName = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames[0] || null

  if (!selectedSheetName) {
    return { sheetNames, selectedSheetName: null, rows: [] }
  }

  const worksheet = workbook.Sheets[selectedSheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: false,
  })

  const headerIndex = matrix.findIndex(isHeaderRow)
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0
  const rows: ParsedImportRow[] = []
  const seenKeys = new Map<string, number>()

  for (let index = startIndex; index < matrix.length; index += 1) {
    const row = matrix[index] || []
    const rowNumber = index + 1
    const player1 = parseImportPlayer(row[0], row[1], options.tournamentGender, "player1")
    const player2 = parseImportPlayer(row[2], row[3], options.tournamentGender, "player2")
    const warnings: string[] = []

    if (!player1 && !player2) {
      continue
    }

    const parsedRow: ParsedImportRow = {
      id: `${selectedSheetName}-${rowNumber}`,
      rowNumber,
      player1,
      player2,
      rowType: player1 && player2 ? "couple" : player1 || player2 ? "individual" : "empty",
      warnings,
    }

    for (const player of [player1, player2]) {
      if (!player) continue
      const key = getImportPlayerKey(player)
      if (!key) continue
      const previousRowNumber = seenKeys.get(key)
      if (previousRowNumber) {
        parsedRow.warnings.push(`Jugador repetido en el Excel. Tambien aparece en la fila ${previousRowNumber}.`)
      } else {
        seenKeys.set(key, rowNumber)
      }
    }

    rows.push(parsedRow)
  }

  return { sheetNames, selectedSheetName, rows }
}

export const getImportPlayerKey = (player: Pick<ParsedImportPlayer, "firstName" | "lastName" | "dni" | "gender">): string => {
  const dni = sanitizeDniInput(player.dni)
  if (dni) return `dni:${dni}`

  const normalizedName = `${normalizePlayerNamePart(player.firstName)} ${normalizePlayerNamePart(player.lastName)}`.trim()
  if (!normalizedName) return ""

  return `name:${normalizedName}:${player.gender}`
}

export const getDefaultDecisionForPlayer = (player: PreviewImportPlayer | null): ImportPlayerDecision | undefined => {
  if (!player) return undefined
  if (player.primaryCandidate && player.hasStrongMatch) {
    return { action: "use", playerId: player.primaryCandidate.id }
  }

  return { action: "create" }
}

export const buildAlreadyInscribedMessage = (playerNames: string[]): string => {
  const cleanNames = playerNames.map(cleanCellText).filter(Boolean)
  if (cleanNames.length === 0) {
    return "Uno de los jugadores ya estaba inscripto. Fila omitida."
  }

  if (cleanNames.length === 1) {
    return `${cleanNames[0]} ya estaba inscripto. Fila omitida.`
  }

  return `${cleanNames.join(" / ")} ya estaban inscriptos. Fila omitida.`
}
