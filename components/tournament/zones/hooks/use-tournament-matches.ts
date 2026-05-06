"use client"

/**
 * Hook for fetching tournament matches data
 */

import { useState, useEffect } from 'react'
import type { Match } from '../types/zone-types'

interface TournamentMatchesHook {
  matches: Match[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTournamentMatches(tournamentId: string): TournamentMatchesHook {
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = async () => {
    if (!tournamentId) {
      setMatches([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/tournaments/${tournamentId}/matches`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.matches) {
        setMatches(data.matches)
      } else {
        throw new Error(data.error || 'Failed to fetch matches')
      }
    } catch (err) {
      console.error('Error fetching tournament matches:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setMatches([])
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchMatches()
  }, [tournamentId])

  return {
    matches,
    isLoading,
    error,
    refresh: fetchMatches
  }
}