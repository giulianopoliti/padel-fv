'use client'

import { useState, useEffect, useRef } from 'react'

interface TournamentFinalizationState {
  status: string
  canShowPointsCalculation: boolean
  winner_id: string | null
  loading: boolean
}

export function useTournamentFinalization(tournamentId: string) {
  const [state, setState] = useState<TournamentFinalizationState>({
    status: 'UNKNOWN',
    canShowPointsCalculation: false,
    winner_id: null,
    loading: true
  })

  const checkTournamentStatus = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/finalization-status`)
      const data = await response.json()

      setState({
        status: data.status,
        canShowPointsCalculation: data.status === 'FINISHED_POINTS_PENDING',
        winner_id: data.winner_id,
        loading: false
      })

    } catch (error) {
      console.error('Error checking tournament finalization:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const isMountedRef = useRef(false)

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      checkTournamentStatus()
    }
  }, [tournamentId])

  return {
    ...state,
    refetch: checkTournamentStatus
  }
}