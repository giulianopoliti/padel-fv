'use client'

import React from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { User, ExternalLink, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlayerAvatarProps {
  playerId?: string
  playerName: string
  isWinner?: boolean
  isBye?: boolean
  score?: number
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
  showTooltip?: boolean
  className?: string
  avatarUrl?: string
}

const sizeConfig = {
  sm: {
    avatar: 'h-8 w-8',
    text: 'text-xs',
    badge: 'h-4 text-xs'
  },
  md: {
    avatar: 'h-10 w-10',
    text: 'text-sm',
    badge: 'h-5 text-xs'
  },
  lg: {
    avatar: 'h-12 w-12',
    text: 'text-base',
    badge: 'h-6 text-sm'
  }
}

export default function PlayerAvatar({
  playerId,
  playerName,
  isWinner = false,
  isBye = false,
  score,
  size = 'md',
  showScore = false,
  showTooltip = true,
  className,
  avatarUrl
}: PlayerAvatarProps) {
  const config = sizeConfig[size]

  // Handle special cases
  if (isBye || playerName === 'BYE') {
    return (
      <div className={cn('flex items-center gap-2 opacity-60', className)}>
        <div className={cn('rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center', config.avatar)}>
          <span className="text-slate-400 font-medium text-xs">BYE</span>
        </div>
        <span className={cn('text-slate-400 italic', config.text)}>BYE</span>
      </div>
    )
  }

  if (!playerName || playerName === 'Por determinar') {
    return (
      <div className={cn('flex items-center gap-2 opacity-60', className)}>
        <div className={cn('rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center', config.avatar)}>
          <User className="h-4 w-4 text-slate-400" />
        </div>
        <span className={cn('text-slate-500', config.text)}>Por determinar</span>
      </div>
    )
  }

  // Player initials for avatar fallback
  const initials = playerName
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const PlayerContent = (
    <div className={cn(
      'flex items-center gap-2 transition-all duration-200',
      isWinner && 'text-green-700 font-semibold',
      playerId && 'group hover:scale-105',
      className
    )}>
      {/* Avatar with glassmorphism effect */}
      <div className="relative">
        <Avatar className={cn(
          config.avatar,
          'border-2 transition-all duration-200 shadow-sm',
          isWinner
            ? 'border-green-500 shadow-green-200'
            : 'border-slate-200 group-hover:border-blue-400 group-hover:shadow-blue-200'
        )}>
          <AvatarImage src={avatarUrl} alt={playerName} />
          <AvatarFallback className={cn(
            'font-semibold transition-colors duration-200',
            isWinner
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-50 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700'
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Winner crown */}
        {isWinner && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1 shadow-sm">
            <Trophy className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Player name and score */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'truncate transition-colors duration-200',
          config.text,
          playerId && 'group-hover:text-blue-700'
        )}>
          {playerName}
        </div>

        {/* Score badge */}
        {showScore && score !== undefined && (
          <Badge
            variant="outline"
            className={cn(
              'mt-1 font-mono',
              config.badge,
              isWinner ? 'border-green-500 text-green-700' : 'border-slate-300'
            )}
          >
            {score}
          </Badge>
        )}
      </div>

      {/* External link icon */}
      {playerId && (
        <ExternalLink className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-blue-600',
          size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
        )} />
      )}
    </div>
  )

  // Wrap with tooltip if enabled
  const WrappedContent = showTooltip && playerId ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {PlayerContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>Ver perfil de {playerName}</p>
          {score !== undefined && <p className="text-xs opacity-80">Puntuación: {score}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : PlayerContent

  // Wrap with link if playerId exists
  if (playerId) {
    return (
      <Link href={`/ranking/${playerId}`} className="block">
        {WrappedContent}
      </Link>
    )
  }

  return WrappedContent
}