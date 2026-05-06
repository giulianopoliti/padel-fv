'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Pause,
  Calendar,
  Timer,
  Trophy
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchStatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showTooltip?: boolean
  animated?: boolean
  className?: string
}

const statusConfig = {
  PENDING: {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Clock,
    description: 'El partido está programado pero no ha comenzado',
    pulse: true
  },
  IN_PROGRESS: {
    label: 'En Curso',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: Play,
    description: 'El partido se está jugando actualmente',
    pulse: true
  },
  FINISHED: {
    label: 'Finalizado',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: CheckCircle,
    description: 'El partido ha terminado',
    pulse: false
  },
  CANCELED: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: XCircle,
    description: 'El partido fue cancelado',
    pulse: false
  },
  POSTPONED: {
    label: 'Pospuesto',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: Pause,
    description: 'El partido fue pospuesto para otra fecha',
    pulse: false
  },
  SCHEDULED: {
    label: 'Programado',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: Calendar,
    description: 'El partido tiene fecha y hora asignada',
    pulse: false
  },
  BYE: {
    label: 'BYE',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: Timer,
    description: 'Partido con BYE - avance automático',
    pulse: false
  },
  WAITING_OPPONENT: {
    label: 'Esperando',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: Timer,
    description: 'Esperando rival para el partido',
    pulse: true
  }
}

const sizeConfig = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3'
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-4 w-4'
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    icon: 'h-5 w-5'
  }
}

export default function MatchStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  showTooltip = true,
  animated = true,
  className
}: MatchStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING
  const sizeConf = sizeConfig[size]
  const IconComponent = config.icon

  const BadgeContent = (
    <Badge
      className={cn(
        'relative border font-medium transition-all duration-200 hover:shadow-md',
        config.color,
        sizeConf.badge,
        animated && config.pulse && (status === 'PENDING' ? 'animate-pulse [animation-duration:3s]' : ''),
        status === 'PENDING' && animated ? 'shadow-md shadow-yellow-300/30' : '',
        'hover:scale-105',
        className
      )}
    >
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full opacity-50" />

      {/* Extra pulse effect for PENDING status */}
      {status === 'PENDING' && animated && (
        <div className="absolute inset-0 bg-yellow-200/20 rounded-full animate-pulse [animation-duration:3s]" />
      )}

      <div className="relative flex items-center gap-1.5">
        {showIcon && (
          <IconComponent className={cn(sizeConf.icon, 'flex-shrink-0')} />
        )}
        <span className="font-semibold">{config.label}</span>

        {/* Pulse dot for active states */}
        {animated && config.pulse && (
          <div className="relative">
            <div className={cn(
              'w-2 h-2 rounded-full',
              status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-yellow-500'
            )}>
              <div className={cn(
                'absolute inset-0 w-2 h-2 rounded-full animate-ping',
                status === 'IN_PROGRESS' ? 'bg-blue-400' : 'bg-yellow-400'
              )} />
            </div>
          </div>
        )}
      </div>
    </Badge>
  )

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {BadgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-semibold">{config.label}</p>
              <p className="text-xs opacity-80 max-w-48">{config.description}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return BadgeContent
}

// Helper function to get status from match object
export function getMatchStatus(match: any): string {
  if (match.status === 'FINISHED' && match.winner_id) {
    return 'FINISHED'
  }

  if (match.status === 'IN_PROGRESS') {
    return 'IN_PROGRESS'
  }

  if (match.status === 'PENDING') {
    // Check if it has scheduled time
    if (match.fecha_matches?.some((fm: any) => fm.scheduled_date)) {
      return 'SCHEDULED'
    }
    return 'PENDING'
  }

  if (match.status === 'BYE') {
    return 'BYE'
  }

  if (match.status === 'WAITING_OPPONENT') {
    return 'WAITING_OPPONENT'
  }

  return match.status || 'PENDING'
}