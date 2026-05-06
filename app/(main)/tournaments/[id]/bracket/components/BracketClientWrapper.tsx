'use client'

import { useState, useEffect } from 'react'
import TournamentBracketTab from '@/components/tournament/tournament-bracket-tab'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/database.types'

interface BracketClientWrapperProps {
  tournamentId: string
  isOwner: boolean
  isPublicView?: boolean
}

/**
 * Client wrapper para TournamentBracketTab (torneos americanos)
 * Necesario porque Server Components no pueden pasar event handlers
 * Fetch tournament status para mostrar vistas condicionales
 */
export default function BracketClientWrapper({
  tournamentId,
  isOwner,
  isPublicView = false
}: BracketClientWrapperProps) {
  const [tournamentStatus, setTournamentStatus] = useState<string>()
  const supabase = createClientComponentClient<Database>()

  // Fetch tournament status
  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single()

      if (data) setTournamentStatus(data.status)
    }
    fetchStatus()
  }, [tournamentId, supabase])

  const handleDataRefresh = () => {
    window.location.reload()
  }

  return (
    <TournamentBracketTab
      tournamentId={tournamentId}
      isOwner={isOwner}
      isPublicView={isPublicView}
      tournamentStatus={tournamentStatus}
      onDataRefresh={handleDataRefresh}
    />
  )
}
