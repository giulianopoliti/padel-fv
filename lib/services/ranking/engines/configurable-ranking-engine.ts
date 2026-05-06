/**
 * CONFIGURABLE RANKING ENGINE
 * 
 * ⚠️  CRITICAL: This engine is NEW and implements configurable ranking for LONG tournaments
 * ⚠️  ZERO IMPACT: Does not affect existing American tournament system
 * 
 * Purpose: Sort couples based on configurable criteria from database
 * Used by: LONG tournaments and future configurable tournament types
 */

import type { ExtendedCoupleStats } from '../interfaces/stats-data-provider.interface'
import type { RankingConfiguration, RankingCriterion } from '../types/ranking-configuration.types'
import type { HeadToHeadResult } from '../../zone-position/types'

export interface TiebreakResult {
  criterion: string
  coupleIds: string[]
  resolvedBy: string
  explanation: string
}

export interface ConfigurableRankingResult {
  rankedCouples: ExtendedCoupleStats[]
  appliedConfiguration: RankingConfiguration
  tiebreakResults: TiebreakResult[]
  calculationMetadata: {
    totalCouples: number
    criteriaApplied: string[]
    calculatedAt: Date
    hasUnresolvedTies: boolean
  }
}

/**
 * Configurable Ranking Engine
 * 
 * Sorts couples based on database-driven ranking configuration.
 * Supports multiple criteria with configurable order and weights.
 */
export class ConfigurableRankingEngine {
  private headToHeadMatrix: HeadToHeadResult[] = []
  private tiebreakResults: TiebreakResult[] = []
  
  /**
   * Main method: Rank couples by configuration
   */
  rankCouplesByConfiguration(
    coupleStats: ExtendedCoupleStats[],
    config: RankingConfiguration,
    headToHeadMatrix: HeadToHeadResult[] = []
  ): ConfigurableRankingResult {
    this.headToHeadMatrix = headToHeadMatrix
    this.tiebreakResults = []
    
    // Validate input
    if (!coupleStats || coupleStats.length === 0) {
      return this.createEmptyResult(config)
    }
    
    // Get enabled criteria in order
    const enabledCriteria = config.criteria
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order)
    
    if (enabledCriteria.length === 0) {
      console.warn('No enabled criteria found in ranking configuration')
      return this.createEmptyResult(config)
    }
    
    // Apply sorting with tiebreak resolution
    const rankedCouples = this.sortWithTiebreakResolution(coupleStats, enabledCriteria)
    
    // Assign final positions
    rankedCouples.forEach((couple, index) => {
      couple.position = index + 1
    })
    
    return {
      rankedCouples,
      appliedConfiguration: config,
      tiebreakResults: this.tiebreakResults,
      calculationMetadata: {
        totalCouples: coupleStats.length,
        criteriaApplied: enabledCriteria.map(c => c.criterion),
        calculatedAt: new Date(),
        hasUnresolvedTies: this.hasUnresolvedTies(rankedCouples, enabledCriteria)
      }
    }
  }
  
  /**
   * Sort couples with intelligent tiebreak resolution
   */
  private sortWithTiebreakResolution(
    couples: ExtendedCoupleStats[],
    criteria: RankingCriterion[]
  ): ExtendedCoupleStats[] {
    return couples.sort((a, b) => {
      // Apply criteria in order until we find a difference
      for (const criterion of criteria) {
        const comparison = this.compareByCriterion(a, b, criterion)
        
        if (comparison !== 0) {
          // Record successful tiebreak resolution
          this.recordTiebreakResolution([a.coupleId, b.coupleId], criterion.criterion, comparison)
          return comparison
        }
      }
      
      // Complete tie - record for manual resolution
      this.recordUnresolvedTie([a.coupleId, b.coupleId], criteria)
      return 0
    })
  }
  
  /**
   * Compare two couples by a specific criterion
   */
  private compareByCriterion(
    a: ExtendedCoupleStats,
    b: ExtendedCoupleStats,
    criterion: RankingCriterion
  ): number {
    const weight = criterion.weight || 1
    
    switch (criterion.criterion) {
      case 'wins':
        return (b.matchesWon - a.matchesWon) * weight
        
      case 'losses':
        return (a.matchesLost - b.matchesLost) * weight // Fewer losses = better
        
      case 'sets_difference':
        return (b.setsDifference - a.setsDifference) * weight
        
      case 'sets_for':
        return (b.setsWon - a.setsWon) * weight
        
      case 'sets_against':
        return (a.setsLost - b.setsLost) * weight // Fewer sets against = better
        
      case 'games_difference':
        return (b.gamesDifference - a.gamesDifference) * weight
        
      case 'games_for':
        return (b.gamesWon - a.gamesWon) * weight
        
      case 'games_against':
        return (a.gamesLost - b.gamesLost) * weight // Fewer games against = better
        
      case 'head_to_head':
        return this.compareHeadToHead(a.coupleId, b.coupleId) * weight
        
      case 'player_scores':
        return (b.totalPlayerScore - a.totalPlayerScore) * weight
        
      case 'random':
        return this.compareRandom(a.coupleId, b.coupleId) * weight
        
      default:
        console.warn(`Unknown ranking criterion: ${criterion.criterion}`)
        return 0
    }
  }
  
  /**
   * Head-to-head comparison between two couples
   */
  private compareHeadToHead(coupleAId: string, coupleBId: string): number {
    const h2h = this.headToHeadMatrix.find(result =>
      (result.coupleAId === coupleAId && result.coupleBId === coupleBId) ||
      (result.coupleAId === coupleBId && result.coupleBId === coupleAId)
    )
    
    if (!h2h || !h2h.matchPlayed || !h2h.winnerCoupleId) {
      return 0 // No head-to-head data available
    }
    
    // Return positive if coupleA won, negative if coupleB won
    if (h2h.winnerCoupleId === coupleAId) {
      return h2h.coupleAId === coupleAId ? 1 : -1
    } else if (h2h.winnerCoupleId === coupleBId) {
      return h2h.coupleAId === coupleAId ? -1 : 1
    }
    
    return 0
  }
  
  /**
   * Deterministic random comparison based on couple IDs
   * This ensures consistent ordering across multiple calculations
   */
  private compareRandom(coupleAId: string, coupleBId: string): number {
    // Use couple IDs to create a deterministic "random" comparison
    // This ensures the same couples always compare the same way
    const hashA = this.simpleHash(coupleAId)
    const hashB = this.simpleHash(coupleBId)
    
    return hashA - hashB
  }
  
  /**
   * Simple hash function for deterministic randomness
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }
  
  /**
   * Record successful tiebreak resolution
   */
  private recordTiebreakResolution(
    coupleIds: string[],
    criterion: string,
    comparison: number
  ): void {
    const winner = comparison > 0 ? coupleIds[1] : coupleIds[0]
    
    this.tiebreakResults.push({
      criterion,
      coupleIds,
      resolvedBy: criterion,
      explanation: `Tie resolved by ${criterion}. Winner: ${winner}`
    })
  }
  
  /**
   * Record unresolved tie for manual intervention
   */
  private recordUnresolvedTie(
    coupleIds: string[],
    criteria: RankingCriterion[]
  ): void {
    this.tiebreakResults.push({
      criterion: 'unresolved',
      coupleIds,
      resolvedBy: 'none',
      explanation: `Complete tie after applying all criteria: ${criteria.map(c => c.criterion).join(', ')}`
    })
  }
  
  /**
   * Check if there are unresolved ties in the final ranking
   */
  private hasUnresolvedTies(
    rankedCouples: ExtendedCoupleStats[],
    criteria: RankingCriterion[]
  ): boolean {
    // Group couples with identical stats across all criteria
    const groups = new Map<string, ExtendedCoupleStats[]>()
    
    for (const couple of rankedCouples) {
      const key = this.createStatsKey(couple, criteria)
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(couple)
    }
    
    // Check if any group has more than one couple
    return Array.from(groups.values()).some(group => group.length > 1)
  }
  
  /**
   * Create a unique key for a couple's stats based on criteria
   */
  private createStatsKey(couple: ExtendedCoupleStats, criteria: RankingCriterion[]): string {
    return criteria.map(criterion => {
      switch (criterion.criterion) {
        case 'wins': return couple.matchesWon
        case 'losses': return couple.matchesLost
        case 'sets_difference': return couple.setsDifference
        case 'sets_for': return couple.setsWon
        case 'sets_against': return couple.setsLost
        case 'games_difference': return couple.gamesDifference
        case 'games_for': return couple.gamesWon
        case 'games_against': return couple.gamesLost
        case 'player_scores': return couple.totalPlayerScore
        default: return 0
      }
    }).join('|')
  }
  
  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(config: RankingConfiguration): ConfigurableRankingResult {
    return {
      rankedCouples: [],
      appliedConfiguration: config,
      tiebreakResults: [],
      calculationMetadata: {
        totalCouples: 0,
        criteriaApplied: [],
        calculatedAt: new Date(),
        hasUnresolvedTies: false
      }
    }
  }
  
  /**
   * Resolve ties between specific couples using head-to-head
   * Useful for complex tie scenarios involving multiple couples
   */
  resolveComplexTieWithHeadToHead(
    tiedCouples: ExtendedCoupleStats[],
    headToHeadMatrix: HeadToHeadResult[]
  ): ExtendedCoupleStats[] {
    if (tiedCouples.length <= 1) return tiedCouples
    
    // Create mini-league table for tied couples
    const miniLeague = tiedCouples.map(couple => ({
      couple,
      h2hWins: 0,
      h2hLosses: 0,
      h2hSetsDiff: 0,
      h2hGamesDiff: 0
    }))
    
    // Calculate head-to-head records among tied couples only
    for (const entry1 of miniLeague) {
      for (const entry2 of miniLeague) {
        if (entry1.couple.coupleId === entry2.couple.coupleId) continue
        
        const h2h = headToHeadMatrix.find(result =>
          (result.coupleAId === entry1.couple.coupleId && result.coupleBId === entry2.couple.coupleId) ||
          (result.coupleAId === entry2.couple.coupleId && result.coupleBId === entry1.couple.coupleId)
        )
        
        if (h2h?.matchPlayed && h2h.winnerCoupleId === entry1.couple.coupleId) {
          entry1.h2hWins++
          entry2.h2hLosses++
          
          // Add sets/games difference if available
          if (h2h.couple1Score !== undefined && h2h.couple2Score !== undefined) {
            const isEntry1CoupleA = h2h.coupleAId === entry1.couple.coupleId
            const entry1Score = isEntry1CoupleA ? h2h.couple1Score : h2h.couple2Score
            const entry2Score = isEntry1CoupleA ? h2h.couple2Score : h2h.couple1Score
            
            entry1.h2hSetsDiff += (entry1Score - entry2Score)
            entry2.h2hSetsDiff += (entry2Score - entry1Score)
          }
        }
      }
    }
    
    // Sort by head-to-head record
    miniLeague.sort((a, b) => {
      // First: H2H wins
      if (b.h2hWins !== a.h2hWins) return b.h2hWins - a.h2hWins
      
      // Second: H2H sets difference
      if (b.h2hSetsDiff !== a.h2hSetsDiff) return b.h2hSetsDiff - a.h2hSetsDiff
      
      // Third: H2H games difference
      if (b.h2hGamesDiff !== a.h2hGamesDiff) return b.h2hGamesDiff - a.h2hGamesDiff
      
      // Fallback to original stats
      return b.couple.setsDifference - a.couple.setsDifference
    })
    
    return miniLeague.map(entry => entry.couple)
  }
}