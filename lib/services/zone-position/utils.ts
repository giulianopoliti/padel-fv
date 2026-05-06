/**
 * Utility functions for zone position calculations
 */

import type { CoupleStats } from './types'
import { TiebreakReason } from './types'

/**
 * Groups couples by a specific numeric property
 */
export function groupCouplesByProperty<T extends CoupleStats>(
  couples: T[],
  propertyExtractor: (couple: T) => number
): T[][] {
  const groups = new Map<number, T[]>()
  
  for (const couple of couples) {
    const value = propertyExtractor(couple)
    if (!groups.has(value)) {
      groups.set(value, [])
    }
    groups.get(value)!.push(couple)
  }
  
  // Return groups sorted by property value (descending)
  return Array.from(groups.entries())
    .sort(([a], [b]) => b - a)
    .map(([, group]) => group)
}

/**
 * Sorts couples by multiple criteria in descending order
 */
export function sortCouplesByMultipleCriteria(
  couples: CoupleStats[],
  criteria: Array<(couple: CoupleStats) => number>
): CoupleStats[] {
  return [...couples].sort((a, b) => {
    for (const criterion of criteria) {
      const valueA = criterion(a)
      const valueB = criterion(b)
      if (valueA !== valueB) {
        return valueB - valueA // Descending order
      }
    }
    return 0
  })
}

/**
 * Performs a cryptographically secure random shuffle
 */
export function secureRandomShuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use crypto.getRandomValues for secure random numbers
    const randomBytes = new Uint32Array(1)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes)
      const randomIndex = randomBytes[0] % (i + 1)
      ;[shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]]
    } else {
      // Fallback for environments without crypto API
      const randomIndex = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]]
    }
  }
  
  return shuffled
}

/**
 * Creates a position tie info string
 */
export function createTieInfo(
  reason: TiebreakReason,
  additionalInfo?: Record<string, any>
): string {
  switch (reason) {
    case TiebreakReason.NO_TIE:
      return 'Clear position based on matches won'
    case TiebreakReason.HEAD_TO_HEAD:
      return `Resolved by head-to-head result${additionalInfo?.opponent ? ` vs ${additionalInfo.opponent}` : ''}`
    case TiebreakReason.GAMES_DIFFERENCE:
      return `Resolved by games difference: ${additionalInfo?.gamesDiff ?? 'N/A'}`
    case TiebreakReason.PLAYER_SCORES:
      return `Resolved by player scores total: ${additionalInfo?.playerScore ?? 'N/A'}`
    case TiebreakReason.GAMES_WON:
      return `Resolved by games won: ${additionalInfo?.gamesWon ?? 'N/A'}`
    case TiebreakReason.RANDOM_TIEBREAKER:
      return 'Resolved by random tiebreaker (perfect tie)'
    default:
      return 'Position determined'
  }
}

/**
 * Validates that couple stats are consistent
 */
export function validateCoupleStats(stats: CoupleStats): boolean {
  // Basic validations
  if (stats.matchesPlayed !== stats.matchesWon + stats.matchesLost) {
    console.warn(`Inconsistent match counts for couple ${stats.coupleId}`)
    return false
  }
  
  if (stats.setsDifference !== stats.setsWon - stats.setsLost) {
    console.warn(`Inconsistent sets difference for couple ${stats.coupleId}`)
    return false
  }
  
  if (stats.gamesDifference !== stats.gamesWon - stats.gamesLost) {
    console.warn(`Inconsistent games difference for couple ${stats.coupleId}`)
    return false
  }
  
  if (stats.totalPlayerScore !== stats.player1Score + stats.player2Score) {
    console.warn(`Inconsistent player score total for couple ${stats.coupleId}`)
    return false
  }
  
  return true
}

/**
 * Deep clones a CoupleStats object
 */
export function cloneCoupleStats(stats: CoupleStats): CoupleStats {
  return {
    ...stats,
    position: stats.position,
    positionTieInfo: stats.positionTieInfo
  }
}