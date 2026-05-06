import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { 
  TimeSlot, 
  TimeSlotValidation, 
  TournamentFecha,
  UserAccess,
  MAX_NOTE_LENGTH
} from './types'

// Utility function for className merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date and time formatting utilities
export const formatDate = (dateString: string): string => {
  // Fix timezone issue: parse date components directly to avoid UTC interpretation
  const [year, month, day] = dateString.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export const formatDateShort = (dateString: string): string => {
  // Fix timezone issue: parse date components directly to avoid UTC interpretation
  const [year, month, day] = dateString.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export const formatDateWithWeekday = (dateString: string): string => {
  // Fix timezone issue: parse date components directly to avoid UTC interpretation
  const [year, month, day] = dateString.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  })
}

export const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
  
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`
}

export const formatDateTime = (date: string, startTime: string, endTime: string): string => {
  return `${formatDate(date)} | ${formatTimeRange(startTime, endTime)}`
}

// Time calculation utilities
export const calculateDuration = (startTime: string, endTime: string): number => {
  const start = new Date(`1970-01-01T${startTime}`)
  const end = new Date(`1970-01-01T${endTime}`)
  return (end.getTime() - start.getTime()) / (1000 * 60) // Return minutes
}

export const addMinutes = (timeString: string, minutes: number): string => {
  const [hours, mins] = timeString.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, mins + minutes, 0, 0)
  
  return date.toTimeString().slice(0, 5) // Return HH:MM format
}

// Validation utilities
export const validateTimeSlot = (timeSlot: Partial<TimeSlot>, existingSlots: TimeSlot[] = []): TimeSlotValidation => {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields validation
  if (!timeSlot.date) {
    errors.push('La fecha es requerida')
  }
  if (!timeSlot.start_time) {
    errors.push('La hora de inicio es requerida')
  }
  if (!timeSlot.end_time) {
    errors.push('La hora de fin es requerida')
  }

  // Time validation
  if (timeSlot.start_time && timeSlot.end_time) {
    const duration = calculateDuration(timeSlot.start_time, timeSlot.end_time)
    
    if (duration <= 0) {
      errors.push('La hora de fin debe ser posterior a la hora de inicio')
    }
    
    if (duration < 60) {
      warnings.push('La duración es menor a 1 hora, puede ser muy corta')
    }
    
    if (duration > 300) {
      warnings.push('La duración es mayor a 5 horas, puede ser muy larga')
    }
  }

  // Date validation
  if (timeSlot.date) {
    // Fix timezone issue: parse date components directly
    const [year, month, day] = timeSlot.date.split('-')
    const slotDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (slotDate < today) {
      errors.push('No se puede crear un horario en el pasado')
    }
  }

  // Overlap validation with existing slots
  if (timeSlot.date && timeSlot.start_time && timeSlot.end_time && timeSlot.court_name) {
    const overlapping = existingSlots.find(existing => 
      existing.date === timeSlot.date &&
      existing.court_name === timeSlot.court_name &&
      existing.id !== timeSlot.id && // Exclude self when editing
      timeRangesOverlap(
        { start: existing.start_time, end: existing.end_time },
        { start: timeSlot.start_time, end: timeSlot.end_time }
      )
    )
    
    if (overlapping) {
      errors.push(`Hay solapamiento con el horario ${formatTimeRange(overlapping.start_time, overlapping.end_time)} en la misma cancha`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

const timeRangesOverlap = (
  range1: { start: string; end: string },
  range2: { start: string; end: string }
): boolean => {
  const start1 = timeToMinutes(range1.start)
  const end1 = timeToMinutes(range1.end)
  const start2 = timeToMinutes(range2.start)
  const end2 = timeToMinutes(range2.end)
  
  return start1 < end2 && start2 < end1
}

const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

// User access utilities
export const canCreateTimeSlots = (userAccess: UserAccess): boolean => {
  return userAccess.isOrganizer
}

export const canEditAvailability = (userAccess: UserAccess): boolean => {
  return userAccess.isInscribed && userAccess.coupleId !== undefined
}

export const canViewFullMatrix = (userAccess: UserAccess): boolean => {
  return userAccess.isOrganizer
}

export const canViewOwnAvailability = (userAccess: UserAccess): boolean => {
  return userAccess.isInscribed
}

// Data transformation utilities
export const groupTimeSlotsByDate = (timeSlots: TimeSlot[]) => {
  return timeSlots.reduce((groups, slot) => {
    const date = slot.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(slot)
    return groups
  }, {} as Record<string, TimeSlot[]>)
}

export const sortTimeSlots = (timeSlots: TimeSlot[], sortBy: 'date' | 'time' | 'court' = 'date'): TimeSlot[] => {
  return [...timeSlots].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        if (a.date !== b.date) {
          // Fix timezone issue: parse date components directly for comparison
          const [yearA, monthA, dayA] = a.date.split('-').map(Number)
          const [yearB, monthB, dayB] = b.date.split('-').map(Number)
          const dateA = new Date(yearA, monthA - 1, dayA)
          const dateB = new Date(yearB, monthB - 1, dayB)
          return dateA.getTime() - dateB.getTime()
        }
        return a.start_time.localeCompare(b.start_time)
      
      case 'time':
        return a.start_time.localeCompare(b.start_time)
      
      case 'court':
        if (a.court_name && b.court_name && a.court_name !== b.court_name) {
          return a.court_name.localeCompare(b.court_name)
        }
        return a.start_time.localeCompare(b.start_time)
      
      default:
        return 0
    }
  })
}

// Note validation utilities  
export const validateNote = (note: string): { isValid: boolean; error?: string } => {
  if (note.length > MAX_NOTE_LENGTH) {
    return {
      isValid: false,
      error: `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`
    }
  }
  
  return { isValid: true }
}

export const getAvailabilityStats = (totalCouples: number, availableCouples: number) => {
  if (totalCouples === 0) return { percentage: 0, label: 'Sin parejas' }
  
  const percentage = Math.round((availableCouples / totalCouples) * 100)
  
  let label = ''
  if (percentage === 0) label = 'Ninguna pareja'
  else if (percentage < 25) label = 'Pocas parejas'
  else if (percentage < 50) label = 'Algunas parejas'
  else if (percentage < 75) label = 'Mayoría disponible'
  else label = 'Casi todas disponibles'
  
  return { percentage, label }
}

// URL utilities
export const buildScheduleUrl = (tournamentId: string, fechaId?: string): string => {
  const base = `/tournaments/${tournamentId}/schedules`
  return fechaId ? `${base}?fecha_id=${fechaId}` : base
}

// Error handling utilities
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Ha ocurrido un error inesperado'
}

// Debounce utility for form inputs
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}