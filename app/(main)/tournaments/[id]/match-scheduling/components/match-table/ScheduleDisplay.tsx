'use client'

import { Clock, MapPin, Calendar } from 'lucide-react'
import { ExistingMatch } from '../../actions'
import { getDayOfWeek, formatTimeRange, formatDateWithDay } from '../../utils/dateUtils'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ScheduleDisplayProps {
  match: ExistingMatch
}

const formatCourt = (court: string | null): string => {
  if (!court) return 'Sin cancha'
  if (court.toLowerCase().includes('cancha')) return court
  return `Cancha ${court}`
}

const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ match }) => {
  const hasCourt = match.court_assignment && match.court_assignment !== 'Sin cancha'

  return (
    <div className="space-y-2 text-sm">
      {/* Date with day of week */}
      {match.scheduled_date && (
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-3 h-3 text-gray-400" />
          <span className="text-xs">
            {formatDateWithDay(match.scheduled_date)}
          </span>
        </div>
      )}

      {/* Time */}
      {match.scheduled_start_time && match.scheduled_end_time && (
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs">
            {formatTimeRange(match.scheduled_start_time, match.scheduled_end_time)}
          </span>
        </div>
      )}

      {/* Court - Only show if assigned */}
      {hasCourt && (
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 text-gray-400" />
          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded border border-orange-300">
            {formatCourt(match.court_assignment)}
          </span>
        </div>
      )}
    </div>
  )
}

export default ScheduleDisplay