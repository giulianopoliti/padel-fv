'use client'

import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'

interface StatusBadgeProps {
  status: string
}

const formatStatus = (status: string, short = false): string => {
  if (short) {
    switch(status) {
      case 'PENDING': return 'Pend.'
      case 'FINISHED': return 'Fin.'
      case 'IN_PROGRESS': return 'Curso'
      case 'COMPLETED': return 'Comp.'
      default: return status.slice(0, 4)
    }
  }

  switch(status) {
    case 'PENDING': return 'Programado'
    case 'FINISHED': return 'Finalizado'
    case 'IN_PROGRESS': return 'En Curso'
    case 'COMPLETED': return 'Completado'
    default: return status
  }
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: string): string => {
    switch(status) {
      case 'PENDING':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300'
      case 'FINISHED':
      case 'COMPLETED':
        return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-300'
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300'
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
    }
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border ${getStatusColor(status)}`}
    >
      {formatStatus(status)}
    </Badge>
  )
}

export default StatusBadge