'use client'

import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
}

const formatStatus = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'Programado'
    case 'FINISHED':
      return 'Finalizado'
    case 'IN_PROGRESS':
      return 'En curso'
    case 'COMPLETED':
      return 'Completado'
    case 'DRAFT':
      return 'Borrador'
    default:
      return status
  }
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200'
    case 'FINISHED':
    case 'COMPLETED':
      return 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200'
    case 'IN_PROGRESS':
      return 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
    case 'DRAFT':
      return 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
    default:
      return 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
  }
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <Badge
      variant="outline"
      className={`border text-xs font-medium ${getStatusColor(status)}`}
    >
      {formatStatus(status)}
    </Badge>
  )
}

export default StatusBadge
