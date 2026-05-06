/**
 * Zone Ranking Engine
 * Implements the complete ranking algorithm with all tiebreaker criteria
 */

import type { CoupleStats, HeadToHeadResult, TiebreakGroup } from './types'
import { TiebreakReason } from './types'
import { groupCouplesByProperty, secureRandomShuffle, createTieInfo, cloneCoupleStats } from './utils'

export class ZoneRankingEngine {
  
  /**
   * Main ranking algorithm - ranks couples by all criteria
   */
  public rankCouplesByAllCriteria(
    coupleStats: CoupleStats[], 
    headToHeadMatrix: HeadToHeadResult[]
  ): CoupleStats[] {
    // Step 1: Group by matches won (primary criterion)
    const matchWinGroups = groupCouplesByProperty(
      coupleStats, 
      couple => couple.matchesWon
    )
    
    const finalRanking: CoupleStats[] = []
    
    // Step 2: Process each group of couples with same match wins
    for (const group of matchWinGroups) {
      if (group.length === 1) {
        // No tie - add directly
        const couple = cloneCoupleStats(group[0])
        couple.positionTieInfo = createTieInfo(TiebreakReason.NO_TIE)
        finalRanking.push(couple)
      } else if (group.length === 2) {
        // Two-way tie
        const resolvedPair = this.resolveTwoWayTie(group, headToHeadMatrix)
        finalRanking.push(...resolvedPair)
      } else {
        // Multi-way tie (3+ couples)
        const resolvedGroup = this.resolveMultiWayTie(group, headToHeadMatrix)
        finalRanking.push(...resolvedGroup)
      }
    }
    
    // Step 3: Assign final positions
    this.assignFinalPositions(finalRanking)
    
    return finalRanking
  }
  
  /**
   * Resolves two-way ties using head-to-head, games difference, player scores, and random tiebreaker
   */
  public resolveTwoWayTie(
    tiedCouples: CoupleStats[], 
    headToHeadMatrix: HeadToHeadResult[]
  ): CoupleStats[] {
    if (tiedCouples.length !== 2) {
      throw new Error('resolveTwoWayTie requires exactly 2 couples')
    }
    
    const [coupleA, coupleB] = tiedCouples.map(cloneCoupleStats)
    
    // Step 1: Check head-to-head result
    const headToHead = this.findHeadToHeadResult(coupleA.coupleId, coupleB.coupleId, headToHeadMatrix)
    
    if (headToHead && headToHead.matchPlayed && headToHead.winnerCoupleId) {
      if (headToHead.winnerCoupleId === coupleA.coupleId) {
        coupleA.positionTieInfo = createTieInfo(TiebreakReason.HEAD_TO_HEAD, { opponent: coupleB.player1Name })
        coupleB.positionTieInfo = createTieInfo(TiebreakReason.HEAD_TO_HEAD, { opponent: coupleA.player1Name })
        return [coupleA, coupleB]
      } else {
        coupleB.positionTieInfo = createTieInfo(TiebreakReason.HEAD_TO_HEAD, { opponent: coupleA.player1Name })
        coupleA.positionTieInfo = createTieInfo(TiebreakReason.HEAD_TO_HEAD, { opponent: coupleB.player1Name })
        return [coupleB, coupleA]
      }
    }
    
    // Step 2: Compare games difference
    if (coupleA.gamesDifference > coupleB.gamesDifference) {
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: coupleA.gamesDifference })
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: coupleB.gamesDifference })
      return [coupleA, coupleB]
    } else if (coupleB.gamesDifference > coupleA.gamesDifference) {
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: coupleB.gamesDifference })
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: coupleA.gamesDifference })
      return [coupleB, coupleA]
    }
    
    // Step 3: Compare games won
    if (coupleA.gamesWon > coupleB.gamesWon) {
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.GAMES_WON, { gamesWon: coupleA.gamesWon })
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.GAMES_WON, { gamesWon: coupleB.gamesWon })
      return [coupleA, coupleB]
    } else if (coupleB.gamesWon > coupleA.gamesWon) {
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.GAMES_WON, { gamesWon: coupleB.gamesWon })
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.GAMES_WON, { gamesWon: coupleA.gamesWon })
      return [coupleB, coupleA]
    }
    
    // Step 4: Compare total player scores
    if (coupleA.totalPlayerScore > coupleB.totalPlayerScore) {
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: coupleA.totalPlayerScore })
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: coupleB.totalPlayerScore })
      return [coupleA, coupleB]
    } else if (coupleB.totalPlayerScore > coupleA.totalPlayerScore) {
      coupleB.positionTieInfo = createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: coupleB.totalPlayerScore })
      coupleA.positionTieInfo = createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: coupleA.totalPlayerScore })
      return [coupleB, coupleA]
    }
    
    // Step 5: Random tiebreaker (perfect tie)
    const shuffledCouples = secureRandomShuffle([coupleA, coupleB])
    shuffledCouples[0].positionTieInfo = createTieInfo(TiebreakReason.RANDOM_TIEBREAKER) + ' (winner)'
    shuffledCouples[1].positionTieInfo = createTieInfo(TiebreakReason.RANDOM_TIEBREAKER) + ' (loser)'
    
    return shuffledCouples
  }
  
  /**
   * Resolves multi-way ties (3+ couples) using games difference, player scores, and random tiebreaker
   */
  public resolveMultiWayTie(
    tiedCouples: CoupleStats[], 
    headToHeadMatrix: HeadToHeadResult[]
  ): CoupleStats[] {
    if (tiedCouples.length < 3) {
      throw new Error('resolveMultiWayTie requires 3 or more couples')
    }
    
    // Step 1: Group by games difference
    const gamesDiffGroups = groupCouplesByProperty(
      tiedCouples, 
      couple => couple.gamesDifference
    )
    
    const finalOrder: CoupleStats[] = []
    
    // Step 2: Process each games difference group
    for (const group of gamesDiffGroups) {
      if (group.length === 1) {
        // Only one couple with this games difference
        const couple = cloneCoupleStats(group[0])
        couple.positionTieInfo = createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: couple.gamesDifference })
        finalOrder.push(couple)
      } else {
        // Multiple couples with same games difference - resolve by games won
        const resolvedGroup = this.resolveByGamesWon(group)
        finalOrder.push(...resolvedGroup)
      }
    }
    
    return finalOrder
  }
  
  /**
   * Resolves ties by player scores, then random tiebreaker
   */
  private resolveByPlayerScores(couplesWithSameGamesWon: CoupleStats[]): CoupleStats[] {
    // Group by total player score
    const playerScoreGroups = groupCouplesByProperty(
      couplesWithSameGamesWon,
      couple => couple.totalPlayerScore
    )
    
    const finalOrder: CoupleStats[] = []
    
    for (const group of playerScoreGroups) {
      if (group.length === 1) {
        // Only one couple with this player score
        const couple = cloneCoupleStats(group[0])
        couple.positionTieInfo = createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: couple.totalPlayerScore })
        finalOrder.push(couple)
      } else {
        // Perfect tie - random tiebreaker
        const shuffledGroup = secureRandomShuffle(group.map(cloneCoupleStats))
        shuffledGroup.forEach(couple => {
          couple.positionTieInfo = createTieInfo(TiebreakReason.RANDOM_TIEBREAKER)
        })
        finalOrder.push(...shuffledGroup)
      }
    }
    
    return finalOrder
  }

  /**
   * Resolves ties by games won, then player scores, then random tiebreaker
   */
  private resolveByGamesWon(couplesWithSameGamesDiff: CoupleStats[]): CoupleStats[] {
    // Group by games won (higher is better)
    const gamesWonGroups = groupCouplesByProperty(
      couplesWithSameGamesDiff,
      couple => couple.gamesWon
    )
    
    const finalOrder: CoupleStats[] = []
    
    for (const group of gamesWonGroups) {
      if (group.length === 1) {
        // Only one couple with this games won count
        const couple = cloneCoupleStats(group[0])
        couple.positionTieInfo = createTieInfo(TiebreakReason.GAMES_WON, { gamesWon: couple.gamesWon })
        finalOrder.push(couple)
      } else {
        // Multiple couples with same games won - resolve by player scores
        const resolvedGroup = this.resolveByPlayerScores(group)
        finalOrder.push(...resolvedGroup)
      }
    }
    
    return finalOrder
  }
  
  /**
   * Assigns final positions to ranked couples
   */
  private assignFinalPositions(rankedCouples: CoupleStats[]): void {
    rankedCouples.forEach((couple, index) => {
      couple.position = index + 1
    })
  }
  
  /**
   * Finds head-to-head result between two couples
   */
  private findHeadToHeadResult(
    coupleAId: string, 
    coupleBId: string, 
    headToHeadMatrix: HeadToHeadResult[]
  ): HeadToHeadResult | null {
    return headToHeadMatrix.find(h2h => 
      h2h.coupleAId === coupleAId && h2h.coupleBId === coupleBId
    ) || null
  }
  
  /**
   * Validates ranking results
   */
  public validateRanking(rankedCouples: CoupleStats[]): boolean {
    // Check positions are sequential
    for (let i = 0; i < rankedCouples.length; i++) {
      if (rankedCouples[i].position !== i + 1) {
        console.error(`Invalid position ${rankedCouples[i].position} at index ${i}`)
        return false
      }
    }
    
    // Check no duplicate positions
    const positions = rankedCouples.map(c => c.position)
    const uniquePositions = new Set(positions)
    if (positions.length !== uniquePositions.size) {
      console.error('Duplicate positions found')
      return false
    }
    
    // Check ranking order makes sense (higher matches won should come first)
    for (let i = 0; i < rankedCouples.length - 1; i++) {
      const current = rankedCouples[i]
      const next = rankedCouples[i + 1]
      
      if (current.matchesWon < next.matchesWon) {
        console.error(`Invalid ranking order: couple at position ${current.position} has fewer wins than position ${next.position}`)
        return false
      }
    }
    
    return true
  }
}