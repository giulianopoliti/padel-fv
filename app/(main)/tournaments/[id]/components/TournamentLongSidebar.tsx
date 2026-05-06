"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useUser } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Calendar,
  FileText,
  Trophy,
  Clock,
  Users,
  Trophy as TrophyIcon,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  EyeOff
} from 'lucide-react'
import OrganizerLogo from './OrganizerLogo'

interface TournamentLongSidebarProps {
  tournament: {
    id: string
    name: string
    category?: string
    is_draft?: boolean
    organization?: {
      name: string
      logo_url?: string | null
      slug?: string
    } | null
    club?: {
      name: string
      logo_url?: string | null
    } | null
  }
  userRole?: string
  playerInscription?: {
    is_eliminated: boolean
    eliminated_at: string | null
    eliminated_in_round: string | null
  } | null
  collapsed?: boolean
  onToggle?: () => void
  mobile?: boolean
  onNavigate?: () => void
  hasManagePermission?: boolean
}

const getNavigationItems = (
  userRole?: string,
  isEliminated?: boolean
) => {
  const isPlayer = userRole === 'PLAYER'

  const baseItems = [
    {
      title: 'Fechas y Horarios',
      href: '/schedules',
      icon: Calendar,
      description: 'Gestión de fechas y horarios',
      showForEliminated: false // Players eliminados no ven horarios
    },
    {
      title: 'Encuentros de qually',
      href: isPlayer ? '/zone-matches' : '/match-scheduling',
      icon: Clock,
      description: isPlayer ? 'Ver partidos de zona' : 'Programación de encuentros',
      showForEliminated: true // Players eliminados pueden ver sus partidos pasados
    },
    {
      title: 'Clasificatoria',
      href: '/qually',
      icon: Trophy,
      description: 'Fase clasificatoria',
      showForEliminated: true // Players eliminados pueden ver clasificatoria
    },
    {
      title: 'Llaves',
      href: '/bracket',
      icon: Zap,
      description: 'Llaves eliminatorias',
      showForEliminated: true // Players eliminados pueden ver llaves
    },
    {
      title: 'Inscripciones',
      href: '/inscriptions',
      icon: Users,
      description: 'Gestión de inscripciones',
      showForEliminated: true // Players eliminados pueden ver inscripciones
    }
  ]

  // Si es player eliminado, filtrar items
  if (isPlayer && isEliminated) {
    return baseItems.filter(item => item.showForEliminated)
  }

  // Solo agregar Configuración para organizadores (no players y solo si hay userRole)
  // Si userRole es undefined, significa que es vista pública (no autenticado)
  if (userRole && !isPlayer) {
    baseItems.push({
      title: 'Configuración',
      href: '/settings',
      icon: Settings,
      description: 'Configuración del torneo',
      showForEliminated: false // No aplica para no-players
    })
  }

  return baseItems
}

export default function TournamentLongSidebar({
  tournament,
  userRole,
  playerInscription,
  collapsed = false,
  onToggle,
  mobile = false,
  onNavigate,
  hasManagePermission = false
}: TournamentLongSidebarProps) {
  const pathname = usePathname()

  const isEliminated = playerInscription?.is_eliminated || false
  const navigationItems = getNavigationItems(userRole, isEliminated)

  const getIsActive = (href: string) => {
    return pathname.includes(href)
  }

  const handleLinkClick = () => {
    if (mobile && onNavigate) {
      onNavigate()
    }
  }

  return (
    <div className={cn(
      "flex flex-col bg-gradient-to-b from-card via-card to-card/95 border-r border-border/50 shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)] relative transition-all duration-300",
      mobile ? "w-full" : collapsed ? "w-16" : "w-64",
      !mobile && "flex-shrink-0 h-full"
    )}>
      {/* Subtle ambient glow effect at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Header Section - Tournament Info */}
      <div className={cn(
        "transition-all duration-300 relative",
        collapsed && !mobile ? "p-3" : "p-6 space-y-4"
      )}>
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-lg blur-xl" />

        {/* Tournament Info with premium icon container */}
        <div className="flex items-start gap-3 relative">
          <div className={cn(
            "flex-shrink-0 p-2.5 rounded-xl transition-all duration-300 relative group",
            "bg-gradient-to-br shadow-lg",
            isEliminated
              ? "from-red-500/10 via-red-400/5 to-orange-500/10 border border-red-500/20 shadow-red-500/10"
              : "from-blue-500/10 via-blue-400/5 to-purple-500/10 border border-blue-500/20 shadow-blue-500/10"
          )}>
            {/* Animated glow on hover */}
            <div className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-all duration-500",
              isEliminated ? "from-red-400/20 to-orange-400/20" : "from-blue-400/20 to-purple-400/20"
            )} />

            <TrophyIcon className={cn(
              "transition-all duration-300 relative z-10",
              collapsed && !mobile ? "h-5 w-5" : "h-6 w-6",
              isEliminated ? "text-red-500" : "text-blue-500",
              "drop-shadow-[0_0_8px_currentColor]"
            )} />
          </div>
          {(!collapsed || mobile) && (
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-base font-semibold text-foreground truncate leading-tight">
                {tournament.name}
              </h2>
              {tournament.category && (
                <p className="text-xs text-muted-foreground font-medium">
                  {tournament.category}
                </p>
              )}
              {isEliminated && (
                <Badge
                  variant="destructive"
                  className="text-xs mt-2 bg-gradient-to-r from-red-500/90 to-orange-500/90 border-0 shadow-lg shadow-red-500/20"
                >
                  Eliminado - {playerInscription?.eliminated_in_round || 'Ronda no especificada'}
                </Badge>
              )}
              {tournament.is_draft && userRole && userRole !== 'PLAYER' && (
                <Badge className="text-xs mt-1 bg-amber-500/90 text-white border-0 flex items-center gap-1 w-fit">
                  <EyeOff className="h-3 w-3" />
                  Borrador
                </Badge>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Navigation Section */}
      <nav className={cn(
        "flex-1 transition-all duration-300",
        collapsed && !mobile ? "px-2 py-4" : "px-3 py-4"
      )}>
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = getIsActive(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <TooltipProvider delayDuration={collapsed && !mobile ? 300 : 999999}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/tournaments/${tournament.id}${item.href}`}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm group relative overflow-hidden",
                          "active:scale-[0.98]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive && [
                            "bg-gradient-to-r from-primary via-primary to-primary/90",
                            "text-primary-foreground font-medium",
                            "shadow-lg shadow-primary/25",
                            "border border-primary/20"
                          ],
                          !isActive && "border border-transparent hover:border-accent hover:bg-accent/50 hover:text-accent-foreground",
                          collapsed && !mobile && "justify-center px-2"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {/* Hover gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />

                        {/* Icon with animation */}
                        <Icon className={cn(
                          "h-4 w-4 flex-shrink-0 transition-all duration-300 relative z-10",
                          "group-hover:scale-110 group-hover:rotate-3",
                          isActive && "drop-shadow-[0_0_4px_currentColor]"
                        )} />

                        {(!collapsed || mobile) && (
                          <span className="truncate relative z-10 transition-all duration-200 group-hover:translate-x-0.5">
                            {item.title}
                          </span>
                        )}

                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-foreground/0 via-primary-foreground to-primary-foreground/0 rounded-r-full" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && !mobile && (
                      <TooltipContent side="right" className="font-medium">
                        {item.title}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse Button */}
      {!mobile && onToggle && (
        <div className="relative px-3 pb-4">
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className={cn(
                    "w-full justify-center transition-all duration-200",
                    "hover:bg-accent",
                    collapsed && "px-2"
                  )}
                  aria-label={collapsed ? "Expandir sidebar de navegación" : "Comprimir sidebar de navegación"}
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {collapsed ? "Expandir menu" : "Comprimir menu"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Footer Section - Club/Organizers Info */}
      {(!collapsed || mobile) && (
        <div className="p-6 border-t border-border">
          <OrganizerLogo
            organization={tournament.organization}
            club={tournament.club}
            collapsed={collapsed && !mobile}
          />
        </div>
      )}
    </div>
  )
}