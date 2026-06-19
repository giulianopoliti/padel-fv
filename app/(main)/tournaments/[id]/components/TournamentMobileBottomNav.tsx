"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, CalendarCheck2, Clock3, Home, Menu, Trophy } from "lucide-react"

import { cn } from "@/lib/utils"

interface TournamentMobileBottomNavProps {
  tournamentId: string
  onMore: () => void
  showAvailability: boolean
  role?: 'PLAYER' | 'ORGANIZER'
}

export const getMobileTournamentNavigationItems = (
  tournamentId: string,
  role: 'PLAYER' | 'ORGANIZER',
  showAvailability: boolean
) => {
  const playerItems = [
    { label: "Inicio", href: `/tournaments/${tournamentId}`, icon: Home },
    ...(showAvailability
      ? [{ label: "Disponibilidad", href: `/tournaments/${tournamentId}/schedules`, icon: CalendarCheck2 }]
      : []),
    { label: "Tablas", href: `/tournaments/${tournamentId}/qually`, icon: BarChart3 },
    { label: "Llave", href: `/tournaments/${tournamentId}/bracket`, icon: Trophy },
  ]
  const organizerItems = [
    { label: "Inicio", href: `/tournaments/${tournamentId}`, icon: Home },
    { label: "Horarios", href: `/tournaments/${tournamentId}/schedules`, icon: CalendarCheck2 },
    { label: "Partidos", href: `/tournaments/${tournamentId}/match-scheduling`, icon: Clock3 },
    { label: "Llave", href: `/tournaments/${tournamentId}/bracket`, icon: Trophy },
  ]

  return role === 'ORGANIZER' ? organizerItems : playerItems
}

const getIsActive = (pathname: string, href: string, tournamentId: string) => {
  const tournamentHome = `/tournaments/${tournamentId}`
  return href === tournamentHome ? pathname === tournamentHome : pathname.startsWith(href)
}

export default function TournamentMobileBottomNav({
  tournamentId,
  onMore,
  showAvailability,
  role = 'PLAYER',
}: TournamentMobileBottomNavProps) {
  const pathname = usePathname()
  const items = getMobileTournamentNavigationItems(tournamentId, role, showAvailability)

  return (
    <nav
      aria-label="Navegacion principal del torneo"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-lg lg:hidden"
    >
      <div className={cn("mx-auto grid max-w-lg", items.length === 4 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map((item) => {
          const active = getIsActive(pathname, item.href, tournamentId)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Abrir menu completo del torneo"
        >
          <Menu className="h-5 w-5" />
          <span>Mas</span>
        </button>
      </div>
    </nav>
  )
}
