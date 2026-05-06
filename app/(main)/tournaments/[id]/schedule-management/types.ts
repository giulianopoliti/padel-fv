// Re-export types from other modules for unified access
export type { CreateFechaData } from '../dates/actions'
export type { CreateTimeSlotData } from '../schedules/actions'

// Types specific to schedule management
export interface UnifiedScheduleData {
  fechas: any[]
  total_couples: number
  couples: any[]
}