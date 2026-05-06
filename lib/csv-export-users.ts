/**
 * Interfaz para los datos de usuario a exportar
 */
export interface UserExportData {
  id: string
  email: string
  role: string
  created_at: string
}

/**
 * Formatea una fecha ISO a DD/MM/YYYY HH:MM
 */
const formatDateTime = (isoDate: string | null): string => {
  if (!isoDate) return ""
  try {
    const date = new Date(isoDate)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return ""
  }
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

/**
 * Traduce el rol a español
 */
const translateRole = (role: string): string => {
  const translations: Record<string, string> = {
    ADMIN: "Administrador",
    CLUB: "Club",
    COACH: "Entrenador",
    PLAYER: "Jugador",
    ORGANIZADOR: "Organizador"
  }
  return translations[role] || role
}

/**
 * Genera y descarga un archivo CSV con los usuarios
 * Implementación nativa sin dependencias externas
 */
export const generateUserCSV = (users: UserExportData[]): void => {
  // Definir headers del CSV
  const headers = ["ID", "Email", "Rol", "Fecha de Creación"]

  // Mapear datos de usuarios a filas
  const rows = users.map((user) => [
    formatValue(user.id),
    formatValue(user.email),
    translateRole(user.role),
    formatDateTime(user.created_at)
  ])

  // Construir CSV línea por línea usando punto y coma (;) como delimitador
  // Esto es lo que Excel en español espera por defecto
  const csvLines = [
    // Header row
    headers.map(escapeCSVValue).join(";"),
    // Data rows
    ...rows.map((row) => row.map(escapeCSVValue).join(";"))
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
  const filename = `usuarios_export_${timestamp}.csv`

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
