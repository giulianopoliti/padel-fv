import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Funciones para manejar fechas en horario de Argentina (UTC-3)
export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires'

/**
 * Convierte una fecha a horario de Argentina y la formatea
 * @param dateString - String de fecha en formato ISO o Date
 * @param options - Opciones de formato
 * @returns Fecha formateada en horario de Argentina
 */
export function formatDateArgentina(
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  if (!dateString) return "Fecha no especificada"
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Fecha no especificada"
    
    return date.toLocaleDateString("es-AR", {
      ...options,
      timeZone: ARGENTINA_TIMEZONE
    })
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Fecha no especificada"
  }
}

/**
 * Convierte una fecha y hora a horario de Argentina y la formatea
 * @param dateString - String de fecha en formato ISO o Date
 * @param options - Opciones de formato
 * @returns Fecha y hora formateada en horario de Argentina
 */
export function formatDateTimeArgentina(
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { 
    day: "numeric", 
    month: "long", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }
): string {
  if (!dateString) return "Fecha no especificada"
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Fecha no especificada"
    
    return date.toLocaleDateString("es-AR", {
      ...options,
      timeZone: ARGENTINA_TIMEZONE
    })
  } catch (error) {
    console.error("Error formatting datetime:", error)
    return "Fecha no especificada"
  }
}

/**
 * Convierte solo la hora a horario de Argentina
 * @param dateString - String de fecha en formato ISO o Date
 * @param options - Opciones de formato
 * @returns Hora formateada en horario de Argentina
 */
export function formatTimeArgentina(
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  if (!dateString) return "Hora no especificada"
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Hora no especificada"
    
    return date.toLocaleTimeString("es-AR", {
      ...options,
      timeZone: ARGENTINA_TIMEZONE
    })
  } catch (error) {
    console.error("Error formatting time:", error)
    return "Hora no especificada"
  }
}

/**
 * Convierte una fecha local a horario de Argentina para almacenamiento
 * @param date - Fecha local
 * @param time - Hora local (opcional)
 * @returns Fecha en formato ISO ajustada a Argentina
 */
export function convertToArgentinaTime(date: string, time?: string): string {
  try {
    let dateTimeString = date
    if (time) {
      const fullTime = time.length === 5 ? `${time}:00` : time
      dateTimeString = `${date}T${fullTime}`
    }
    
    // Crear la fecha asumiendo que es horario de Argentina
    const localDate = new Date(dateTimeString)
    
    // Ajustar a UTC considerando el offset de Argentina (-3)
    const argentinaOffset = -3 * 60 // Argentina es UTC-3, en minutos
    const utcTime = localDate.getTime() - (argentinaOffset * 60 * 1000)
    
    return new Date(utcTime).toISOString()
  } catch (error) {
    console.error("Error converting to Argentina time:", error)
    return new Date().toISOString()
  }
}

/**
 * Obtiene la fecha actual en horario de Argentina
 * @returns Fecha actual en formato ISO ajustada a Argentina
 */
export function getCurrentArgentinaTime(): string {
  const now = new Date()
  const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: ARGENTINA_TIMEZONE }))
  return argentinaTime.toISOString()
}
