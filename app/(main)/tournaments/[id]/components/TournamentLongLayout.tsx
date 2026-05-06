"use client"

import React, { useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { useUser } from '@/contexts/user-context'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import TournamentLongSidebar from './TournamentLongSidebar'
import TournamentAmericanSidebar from './TournamentAmericanSidebar'
import TournamentMobileHeader from './TournamentMobileHeader'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface TournamentLongLayoutProps {
  children: React.ReactNode
}

// Pages que NO deben mostrar la sidebar
const EXCLUDED_PAGES = [
  '/tournaments/[id]/recategorize-players' // Página temporal
]

const fetcher = async (tournamentId: string) => {
  console.log('[FETCHER] Starting fetch for tournamentId:', tournamentId)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      id,
      name,
      category_name,
      type,
      club_id,
      status,
      is_draft,
      organization_id,
      organizaciones:organization_id(name, logo_url, slug),
      clubes:club_id(name, logo_url)
    `)
    .eq('id', tournamentId)
    .single()

  console.log('[FETCHER] Response data:', data)
  console.log('[FETCHER] Response error:', error)

  if (error) {
    console.error('[FETCHER] Error occurred:', error)
    throw error
  }
  return data
}

const playerInscriptionFetcher = async (key: string) => {
  const [, tournamentId, playerId] = key.split('-')
  const supabase = createClient()

  const { data, error } = await supabase
    .from('inscriptions')
    .select(`
      is_eliminated,
      eliminated_at,
      eliminated_in_round,
      player_id,
      couples:couple_id(
        player1_id,
        player2_id
      )
    `)
    .eq('tournament_id', tournamentId)
 
  if (error) {
    return null // Player not inscribed
  }

  const inscription = (data || []).find((row: any) => {
    if (row.player_id === playerId) return true
    const couple = Array.isArray(row.couples) ? row.couples[0] : row.couples
    if (!couple) return false
    return couple.player1_id === playerId || couple.player2_id === playerId
  })

  if (!inscription) {
    return null
  }

  return {
    is_eliminated: inscription.is_eliminated,
    eliminated_at: inscription.eliminated_at,
    eliminated_in_round: inscription.eliminated_in_round
  }
}

const permissionsFetcher = async (key: string) => {
  const [, userId, tournamentId] = key.split('-')
  const permissions = await checkTournamentPermissions(userId, tournamentId)
  return permissions.hasPermission
}

function TournamentLongLayout({ children }: TournamentLongLayoutProps) {
  const params = useParams()
  const pathname = usePathname()
  const tournamentId = params?.id as string
  const { userDetails } = useUser()
  const isMobile = useIsMobile()

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Desktop sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Verificar si la página actual debe mostrar sidebar
  const shouldShowSidebar = !EXCLUDED_PAGES.some(excludedPath => {
    const normalizedPath = pathname.replace(`/tournaments/${tournamentId}`, '/tournaments/[id]')
    return normalizedPath === excludedPath
  })

  // DEBUG LOGS
  console.log('[TournamentLongLayout] pathname:', pathname)
  console.log('[TournamentLongLayout] tournamentId:', tournamentId)
  console.log('[TournamentLongLayout] normalizedPath:', pathname.replace(`/tournaments/${tournamentId}`, '/tournaments/[id]'))
  console.log('[TournamentLongLayout] shouldShowSidebar:', shouldShowSidebar)
  console.log('[TournamentLongLayout] isMobile:', isMobile)
  console.log('[TournamentLongLayout] window.innerWidth:', typeof window !== 'undefined' ? window.innerWidth : 'server')

  // Obtener datos del torneo usando SWR
  const { data: tournament, isLoading, error } = useSWR(
    shouldShowSidebar && tournamentId ? `tournament-sidebar-${tournamentId}` : null,
    () => fetcher(tournamentId)
  )

  // Obtener datos de inscripción si es un player
  const { data: playerInscription } = useSWR(
    shouldShowSidebar && tournamentId && userDetails?.role === 'PLAYER' && userDetails?.player_id
      ? `player-inscription-${tournamentId}-${userDetails.player_id}`
      : null,
    playerInscriptionFetcher
  )

  // Obtener permisos de gestión del torneo
  // NOTA: Este fetch ya no se usa en TournamentLongSidebar (usa userRole directamente como TournamentAmericanSidebar)
  // Se mantiene por compatibilidad futura
  const { data: hasManagePermission } = useSWR(
    shouldShowSidebar && tournamentId && userDetails?.id
      ? `permissions-${userDetails.id}-${tournamentId}`
      : null,
    permissionsFetcher
  )

  console.log('[TournamentLongLayout] tournament:', tournament)
  console.log('[TournamentLongLayout] isLoading:', isLoading)
  console.log('[TournamentLongLayout] error:', error)

  // Si no debe mostrar sidebar, renderizar solo el contenido
  if (!shouldShowSidebar) {
    return <>{children}</>
  }

  // Si está cargando, renderizar solo el contenido
  if (isLoading || !tournament) {
    return <>{children}</>
  }

  // Si no es LONG ni AMERICAN, renderizar solo el contenido
  if (tournament.type !== 'LONG' && tournament.type !== 'AMERICAN') {
    return <>{children}</>
  }

  // Renderizar layout con sidebar para torneos LONG y AMERICAN
  console.log('[TournamentLongLayout] RENDERING SIDEBAR! 🎉', 'Type:', tournament.type)

  // Seleccionar componente de sidebar según tipo de torneo
  const SidebarComponent = tournament.type === 'LONG'
    ? TournamentLongSidebar
    : TournamentAmericanSidebar

  const sidebarProps = {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      category: tournament.category_name,
      status: tournament.status,
      is_draft: tournament.is_draft ?? false,
      organization: tournament.organizaciones ? {
        name: tournament.organizaciones.name,
        logo_url: tournament.organizaciones.logo_url,
        slug: tournament.organizaciones.slug
      } : null,
      club: tournament.clubes ? {
        name: tournament.clubes.name,
        logo_url: tournament.clubes.logo_url
      } : null
    },
    userRole: userDetails?.role,
    playerInscription: playerInscription,
    collapsed: sidebarCollapsed,
    onToggle: () => setSidebarCollapsed(!sidebarCollapsed),
    hasManagePermission: hasManagePermission || false
  }

  if (isMobile) {
    // Mobile: Sheet/Drawer pattern
    console.log('[TournamentLongLayout] Rendering MOBILE layout with tournament:', sidebarProps.tournament.name)
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile Header - Sticky at top */}
        <TournamentMobileHeader
          tournament={sidebarProps.tournament}
          onSidebarToggle={() => {
            console.log('[TournamentLongLayout] Mobile header clicked - opening sidebar')
            setSidebarOpen(true)
          }}
        />

        {/* Mobile Sidebar Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">Menú del Torneo</SheetTitle>
            <SidebarComponent
              {...sidebarProps}
              mobile={true}
              onNavigate={() => setSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content - Full width on mobile, no internal scroll */}
        <main>
          {children}
        </main>
      </div>
    )
  }

  // Desktop: Collapsible sidebar
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-shrink-0 sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto">
        <SidebarComponent {...sidebarProps} />
      </div>
      <main className="flex-1 bg-slate-50">
        {children}
      </main>
    </div>
  )
}

export default TournamentLongLayout
