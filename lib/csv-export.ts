/**
 * Interfaz para los datos de jugador a exportar
 */
export interface PlayerExportData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  email: string | null
  phone: string | null
  score: number
  category_name: string | null
  gender: string | null
  status: string
  date_of_birth: string | null
  address: string | null
  instagram_handle: string | null
  preferred_hand: string | null
  preferred_side: string | null
  racket: string | null
  club_name: string | null
  organizador_name: string | null
  es_prueba: boolean
  created_at: string
  profile_image_url: string | null
}

/**
 * Formatea una fecha ISO a DD/MM/YYYY
 */
const formatDate = (isoDate: string | null): string => {
  if (!isoDate) return ""
  try {
    const date = new Date(isoDate)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return ""
  }
}

/**
 * Formatea un booleano a texto en español
 */
const formatBoolean = (value: boolean | null): string => {
  if (value === null || value === undefined) return ""
  return value ? "Sí" : "No"
}

/**
 * Convierte null/undefined a string vacío
 */
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return ""
  return String(value)
}

/**
 * Escapa un valor para CSV
 * Maneja comillas dobles, punto y coma y saltos de línea según el estándar RFC 4180
 */
const escapeCSVValue = (value: any): string => {
  if (value === null || value === undefined) return ""

  const stringValue = String(value)

  // Si el valor contiene comillas dobles, punto y coma o saltos de línea,
  // debe ser envuelto en comillas y las comillas internas deben duplicarse
  if (stringValue.includes('"') || stringValue.includes(';') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Genera y descarga un archivo CSV con los jugadores
 * Implementación nativa sin dependencias externas
 */
export const generatePlayerCSV = (players: PlayerExportData[]): void => {
  // Definir headers del CSV
  const headers = [
    "ID",
    "Nombre",
    "Apellido",
    "DNI",
    "Email",
    "Teléfono",
    "Puntaje",
    "Categoría",
    "Género",
    "Estado",
    "Fecha de nacimiento",
    "Dirección",
    "Instagram",
    "Mano preferida",
    "Lado preferido",
    "Raqueta",
    "Club",
    "Organizador",
    "Es jugador de prueba",
    "Fecha de creación",
    "URL imagen de perfil"
  ]

  // Mapear datos de jugadores a filas
  const rows = players.map((player) => [
    formatValue(player.id),
    formatValue(player.first_name),
    formatValue(player.last_name),
    formatValue(player.dni),
    formatValue(player.email),
    formatValue(player.phone),
    formatValue(player.score),
    formatValue(player.category_name),
    formatValue(player.gender),
    formatValue(player.status),
    formatDate(player.date_of_birth),
    formatValue(player.address),
    formatValue(player.instagram_handle),
    formatValue(player.preferred_hand),
    formatValue(player.preferred_side),
    formatValue(player.racket),
    formatValue(player.club_name),
    formatValue(player.organizador_name),
    formatBoolean(player.es_prueba),
    formatDate(player.created_at),
    formatValue(player.profile_image_url)
  ])

  // Construir CSV línea por línea usando punto y coma (;) como delimitador
  // Esto es lo que Excel en español espera por defecto
  const csvLines = [
    // Header row
    headers.map(escapeCSVValue).join(";"),
    // Data rows
    ...rows.map(row => row.map(escapeCSVValue).join(";"))
  ]

  // Unir todas las líneas con saltos de línea Windows (\r\n)
  const csvContent = csvLines.join("\r\n")

  // Agregar UTF-8 BOM al inicio para que Excel reconozca correctamente
  // los caracteres especiales (acentos, ñ, etc.)
  const csvWithBOM = "\uFEFF" + csvContent

  // Crear Blob con el contenido CSV
  const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  // Generar nombre de archivo con timestamp
  const timestamp = new Date().toISOString().split("T")[0] // YYYY-MM-DD
  const filename = `jugadores_export_${timestamp}.csv`

  // Crear link temporal y hacer click para descargar
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()

  // Limpiar
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
