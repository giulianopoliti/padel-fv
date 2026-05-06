"use client"

/**
 * Hook for calculating couple games statistics from matches
 * 
 * Calculates games won/lost for each couple in a zone based on match results.
 * Used to replace the old "partidos" (matches) system with "games" system.
 */

import { useMemo } from 'react'
import type { Match } from '../types/zone-types'

export interface CoupleGamesStats {
  coupleId: string
  gamesWon: number
  gamesLost: number
  gamesDifference: number
  matchesPlayed: number
}

export interface UseCoupleGamesStatsReturn {
  getStatsForCouple: (coupleId: string) => CoupleGamesStats
  getAllStats: () => Record<string, CoupleGamesStats>
  isLoading: boolean
}

/**
 * Custom hook to calculate games statistics for couples from match data
 */
export function useCoupleGamesStats(
  matches: Match[] = [],
  zoneId?: string
): UseCoupleGamesStatsReturn {
  // Filter matches for the specific zone if provided
  const filteredMatches = useMemo(() => {
    if (!zoneId) return matches
    return matches.filter(match => match.zone_id === zoneId)
  }, [matches, zoneId])

  // Calculate statistics for all couples
  const coupleStatsMap = useMemo(() => {
    const statsMap: Record<string, CoupleGamesStats> = {}

    filteredMatches.forEach(match => {
      const { couple1_id, couple2_id, result_couple1, result_couple2, status } = match

      // Only count finished matches with valid results
      if (status !== 'FINISHED' || !result_couple1 || !result_couple2) {
        return
      }

      // Parse games from results (should be numbers like "6", "4")
      const games1 = parseInt(result_couple1, 10)
      const games2 = parseInt(result_couple2, 10)

      // Skip if results are not valid numbers
      if (isNaN(games1) || isNaN(games2)) {
        console.warn('Invalid match result:', { result_couple1, result_couple2, matchId: match.id })
        return
      }

      // Initialize stats for couple1 if not exists
      if (!statsMap[couple1_id]) {
        statsMap[couple1_id] = {
          coupleId: couple1_id,
          gamesWon: 0,
          gamesLost: 0,
          gamesDifference: 0,
          matchesPlayed: 0
        }
      }

      // Initialize stats for couple2 if not exists
      if (!statsMap[couple2_id]) {
        statsMap[couple2_id] = {
          coupleId: couple2_id,
          gamesWon: 0,
          gamesLost: 0,
          gamesDifference: 0,
          matchesPlayed: 0
        }
      }

      // Update couple1 stats
      statsMap[couple1_id].gamesWon += games1
      statsMap[couple1_id].gamesLost += games2
      statsMap[couple1_id].matchesPlayed += 1

      // Update couple2 stats
      statsMap[couple2_id].gamesWon += games2
      statsMap[couple2_id].gamesLost += games1
      statsMap[couple2_id].matchesPlayed += 1
    })

    // Calculate games difference for each couple
    Object.values(statsMap).forEach(stats => {
      stats.gamesDifference = stats.gamesWon - stats.gamesLost
    })

    return statsMap
  }, [filteredMatches])

  // Function to get stats for a specific couple
  const getStatsForCouple = useMemo(() => 
    (coupleId: string): CoupleGamesStats => {
      return coupleStatsMap[coupleId] || {
        coupleId,
        gamesWon: 0,
        gamesLost: 0,
        gamesDifference: 0,
        matchesPlayed: 0
      }
    }, [coupleStatsMap]
  )

  // Function to get all stats
  const getAllStats = useMemo(() => 
    (): Record<string, CoupleGamesStats> => coupleStatsMap,
    [coupleStatsMap]
  )

  return {
    getStatsForCouple,
    getAllStats,
    isLoading: false // This hook processes data synchronously
  }
}

/**
 * Utility function to format games difference for display
 */
export function formatGamesDifference(difference: number): string {
  if (difference > 0) {
    return `+${difference}`
  }
  return difference.toString()
}

/**
 * Utility function to get games ratio as string for display
 */
export function formatGamesRatio(gamesWon: number, gamesLost: number): string {
  return `${gamesWon}-${gamesLost}`
}

export default useCoupleGamesStats