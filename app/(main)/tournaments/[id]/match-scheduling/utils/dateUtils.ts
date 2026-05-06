// Utility functions for date formatting and display

/**
 * Get day of week in Spanish
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Spanish day name
 */
export const getDayOfWeek = (dateString: string): string => {
  const date = new Date(dateString + 'T12:00:00') // Add time to avoid timezone issues
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[date.getDay()]
}

/**
 * Format date with day of week
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string like "Sábado 14/12"
 */
export const formatDateWithDay = (dateString: string): string => {
  const date = new Date(dateString + 'T12:00:00')
  const dayName = getDayOfWeek(dateString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  
  return `${dayName} ${day}/${month}`
}

/**
 * Format time range
 * @param startTime - Start time string (HH:MM:SS)
 * @param endTime - End time string (HH:MM:SS)
 * @returns Formatted time range like "09:00 - 10:00"
 */
export const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = startTime ? startTime.slice(0, 5) : ''
  const end = endTime ? endTime.slice(0, 5) : ''
  
  if (start && end) {
    return `${start} - ${end}`
  } else if (start) {
    return start
  }
  
  return 'N/A'
}