"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Calendar,
  Trophy,
  Clock,
  Users,
  Trophy as TrophyIcon,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Home,
  BarChart3
} from 'lucide-react'
import OrganizerLogo from './OrganizerLogo'

interface TournamentLongSidebarProps {
  tournament: {
    id: string
    name: string
    category?: string
    enable_public_inscriptions?: boolean | null
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
    is_pending?: boolean
    eliminated_at: string | null
    eliminated_in_round: string | null
  } | null
  collapsed?: boolean
  onToggle?: () => void
  mobile?: boolean
  onNavigate?: () => void
  hasManagePermission?: boolean
}

interface NavigationItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  showForEliminated: boolean
  requiresParticipantVisibility?: boolean
}

export const getLongNavigationItems = (
  userRole?: string,
  isEliminated?: boolean,
  canViewParticipantPages: boolean = true,
  isPending: boolean = false
) => {
  const isPlayer = userRole === 'PLAYER'

  if (isPlayer) {
    const playerItems: NavigationItem[] = [
      {
        title: 'Inicio',
        href: '',
        icon: Home,
        description: 'Resumen del torneo',
        showForEliminated: true
      },
      {
        title: 'Cargar disponibilidad',
        href: '/schedules',
        icon: Calendar,
        description: 'Informar dias y horarios',
        showForEliminated: false
      },
      {
        title: 'Tablas de posiciones',
        href: '/qually',
        icon: BarChart3,
        description: 'Posiciones del torneo',
        showForEliminated: true,
        requiresParticipantVisibility: true
      },
      {
        title: 'Llave',
        href: '/bracket',
        icon: Zap,
        description: 'Llave eliminatoria',
        showForEliminated: true
      }
    ]

    return playerItems.filter(item =>
      (!isEliminated || item.showForEliminated) &&
      (!isPending || item.href !== '/schedules') &&
      (canViewParticipantPages || !item.requiresParticipantVisibility)
    )
  }

  const baseItems: NavigationItem[] = [
    {
      title: 'Inicio',
      href: '',
      icon: Home,
      description: 'Resumen del torneo',
      showForEliminated: true
    },
    {
      title: 'Fechas y Horarios',
      href: '/schedules',
      icon: Calendar,
      description: 'Gestión de fechas y horarios',
      showForEliminated: false
    },
    {
      title: 'Encuentros de qually',
      href: isPlayer ? '/zone-matches' : '/match-scheduling',
      icon: Clock,
      description: isPlayer ? 'Ver partidos de zona' : 'Programación de encuentros',
      showForEliminated: true
    },
    {
      title: 'Tablas de posiciones',
      href: '/qually',
      icon: BarChart3,
      description: 'Resultados y posiciones',
      showForEliminated: true,
      requiresParticipantVisibility: true
    },
    {
      title: 'Llave',
      href: '/bracket',
      icon: Zap,
      description: 'Llave eliminatoria',
      showForEliminated: true
    },
    {
      title: 'Inscripciones',
      href: '/inscriptions',
      icon: Users,
      description: 'Gestión de inscripciones',
      showForEliminated: true,
      requiresParticipantVisibility: true
    }
  ]

  const visibleItems = baseItems.filter(item =>
    canViewParticipantPages || !item.requiresParticipantVisibility
  )

  if (isPlayer && isEliminated) {
    return visibleItems.filter(item => item.showForEliminated)
  }

  if (userRole && !isPlayer) {
    visibleItems.push({
      title: 'Configuración',
      href: '/settings',
      icon: Settings,
      description: 'Configuración del torneo',
      showForEliminated: false
    })
  }

  return visibleItems
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
  const isPending = playerInscription?.is_pending || false
  const hasActivePlayerInscription = Boolean(playerInscription && !playerInscription.is_eliminated && !playerInscription.is_pending)
  const canViewParticipantPages =
    Boolean(tournament.enable_public_inscriptions) ||
    hasManagePermission ||
    hasActivePlayerInscription

  const navigationItems = getLongNavigationItems(userRole, isEliminated, canViewParticipantPages, isPending)

  const getIsActive = (href: string) => {
    const tournamentHome = `/tournaments/${tournament.id}`
    return href === '' ? pathname === tournamentHome : pathname.includes(href)
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
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className={cn(
        "transition-all duration-300 relative",
        collapsed && !mobile ? "p-3" : "p-6 space-y-4"
      )}>
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 via-transparent to-accent/10 blur-xl" />

        <div className="flex items-start gap-3 relative">
          <div className={cn(
            "flex-shrink-0 p-2.5 rounded-xl transition-all duration-300 relative group",
            "bg-gradient-to-br shadow-lg",
            isEliminated
              ? "from-red-500/10 via-red-400/5 to-orange-500/10 border border-red-500/20 shadow-red-500/10"
              : "from-primary/15 via-primary/5 to-accent/15 border border-primary/20 shadow-primary/10"
          )}>
            <div className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-all duration-500",
              isEliminated ? "from-red-400/20 to-orange-400/20" : "from-primary/20 to-accent/20"
            )} />

            <TrophyIcon className={cn(
              "transition-all duration-300 relative z-10",
              collapsed && !mobile ? "h-5 w-5" : "h-6 w-6",
              isEliminated ? "text-red-500" : "text-primary",
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
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-accent/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

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
