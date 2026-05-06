"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TournamentMobileHeaderProps {
  tournament: {
    id: string
    name: string
    category?: string
  }
  onSidebarToggle: () => void
  className?: string
}

export default function TournamentMobileHeader({
  tournament,
  onSidebarToggle,
  className
}: TournamentMobileHeaderProps) {
  console.log('[TournamentMobileHeader] Rendering:', tournament.name)

  return (
    <div className={cn(
      "sticky top-0 z-10 h-16",
      "bg-gradient-to-b from-card/95 via-card/98 to-card/95",
      "backdrop-blur-md border-b border-border/50",
      "shadow-lg shadow-black/5",
      "flex items-center justify-between px-4",
      "lg:hidden",
      className
    )}>
      {/* Ambient top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Left: Enhanced Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSidebarToggle}
        className={cn(
          "hover:bg-accent/50 rounded-lg transition-all duration-200",
          "hover:scale-110 active:scale-95",
          "hover:shadow-lg hover:shadow-primary/10"
        )}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </Button>

      {/* Center: Enhanced Tournament Info */}
      <div className="flex-1 flex items-center justify-center min-w-0 mx-4">
        <div className="flex items-center gap-2 min-w-0">
          {/* Premium icon badge */}
          <div className="flex-shrink-0 p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Trophy className="h-4 w-4 text-blue-500 drop-shadow-[0_0_4px_currentColor]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate text-foreground">
              {tournament.name}
            </h1>
            {tournament.category && (
              <p className="text-xs text-muted-foreground truncate font-medium">
                {tournament.category}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Close button */}
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={cn(
          "hover:bg-destructive/10 rounded-lg transition-all duration-200",
          "hover:scale-110 active:scale-95"
        )}
      >
        <Link href={`/tournaments/${tournament.id}`}>
          <X className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors duration-200" />
          <span className="sr-only">Cerrar</span>
        </Link>
      </Button>
    </div>
  )
}