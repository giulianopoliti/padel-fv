/**
 * Integration tests for the complete Zone Position System
 */

import { ZonePositionService } from '../zone-position.service'
import { ZoneStatsCalculator } from '../zone-stats-calculator'
import { ZoneRankingEngine } from '../zone-ranking-engine'
import type { CoupleData, MatchData } from '../types'

describe('Zone Position System Integration Tests', () => {
  
  const createIntegrationData = () => {
    const couples: CoupleData[] = [
      {
        id: 'couple1',
        player1_id: 'p1',
        player2_id: 'p2',
        player1: { id: 'p1', first_name: 'John', last_name: 'Doe', score: 400 },
        player2: { id: 'p2', first_name: 'Jane', last_name: 'Smith', score: 350 }
      },
      {
        id: 'couple2',
        player1_id: 'p3',
        player2_id: 'p4',
        player1: { id: 'p3', first_name: 'Bob', last_name: 'Wilson', score: 300 },
        player2: { id: 'p4', first_name: 'Alice', last_name: 'Brown', score: 320 }
      },
      {
        id: 'couple3',
        player1_id: 'p5',
        player2_id: 'p6',
        player1: { id: 'p5', first_name: 'Charlie', last_name: 'Davis', score: 280 },
        player2: { id: 'p6', first_name: 'Diana', last_name: 'Miller', score: 290 }
      },
      {
        id: 'couple4',
        player1_id: 'p7',
        player2_id: 'p8',
        player1: { id: 'p7', first_name: 'Frank', last_name: 'Garcia', score: 250 },
        player2: { id: 'p8', first_name: 'Grace', last_name: 'Lee', score: 260 }
      }
    ]
    
    const matches: MatchData[] = [
      // couple1 vs couple2: couple1 wins 2-1
      {
        id: 'match1',
        couple1_id: 'couple1',
        couple2_id: 'couple2',
        result_couple1: 2,
        result_couple2: 1,
        winner_id: 'couple1',
        status: 'FINISHED',
        zone_id: 'zone1'
      },
      // couple1 vs couple3: couple3 wins 2-0  
      {
        id: 'match2',
        couple1_id: 'couple1',
        couple2_id: 'couple3',
        result_couple1: 0,
        result_couple2: 2,
        winner_id: 'couple3',
        status: 'FINISHED',
        zone_id: 'zone1'
      },
      // couple1 vs couple4: couple1 wins 2-1
      {
        id: 'match3',
        couple1_id: 'couple1',
        couple2_id: 'couple4',
        result_couple1: 2,
        result_couple2: 1,
        winner_id: 'couple1',
        status: 'FINISHED',
        zone_id: 'zone1'
      },
      // couple2 vs couple3: couple2 wins 2-0
      {
        id: 'match4',
        couple1_id: 'couple2',
        couple2_id: 'couple3',
        result_couple1: 2,
        result_couple2: 0,
        winner_id: 'couple2',
        status: 'FINISHED',
        zone_id: 'zone1'
      },
      // couple2 vs couple4: couple2 wins 2-1
      {
        id: 'match5',
        couple1_id: 'couple2',
        couple2_id: 'couple4',
        result_couple1: 2,
        result_couple2: 1,
        winner_id: 'couple2',
        status: 'FINISHED',
        zone_id: 'zone1'
      },
      // couple3 vs couple4: couple3 wins 2-0
      {
        id: 'match6',
        couple1_id: 'couple3',
        couple2_id: 'couple4',
        result_couple1: 2,
        result_couple2: 0,
        winner_id: 'couple3',
        status: 'FINISHED',
        zone_id: 'zone1'
      }
    ]
    
    return { couples, matches }
  }
  
  describe('Complete Tournament Scenario', () => {
    it('should correctly calculate final positions for complete zone', () => {
      const { couples, matches } = createIntegrationData()
      
      // Expected results:
      // couple1: 2 wins (vs couple2, couple4), 1 loss (vs couple3)
      // couple2: 2 wins (vs couple3, couple4), 1 loss (vs couple1)  
      // couple3: 2 wins (vs couple1, couple4), 1 loss (vs couple2)
      // couple4: 0 wins, 3 losses
      
      const calculator = new ZoneStatsCalculator()
      const engine = new ZoneRankingEngine()
      
      // Calculate stats
      const coupleStats = calculator.calculateAllCoupleStats(couples, matches)
      
      // Verify individual stats
      const couple1Stats = coupleStats.find(c => c.coupleId === 'couple1')!
      expect(couple1Stats.matchesWon).toBe(2)
      expect(couple1Stats.matchesLost).toBe(1)
      expect(couple1Stats.setsWon).toBe(4) // 2+0+2
      expect(couple1Stats.setsLost).toBe(4) // 1+2+1
      expect(couple1Stats.setsDifference).toBe(0)
      expect(couple1Stats.totalPlayerScore).toBe(750) // 400+350
      
      const couple4Stats = coupleStats.find(c => c.coupleId === 'couple4')!
      expect(couple4Stats.matchesWon).toBe(0)
      expect(couple4Stats.matchesLost).toBe(3)
      expect(couple4Stats.totalPlayerScore).toBe(510) // 250+260
      
      // Create head-to-head matrix
      const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, matches)
      
      // Rank couples
      const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
      
      // Verify ranking is valid
      expect(engine.validateRanking(rankedCouples)).toBe(true)
      
      // couple4 should be last (0 wins)
      const lastPlace = rankedCouples.find(c => c.position === 4)!
      expect(lastPlace.coupleId).toBe('couple4')
      
      // couples 1, 2, 3 all have 2 wins - need tiebreakers
      const topThree = rankedCouples.slice(0, 3)
      topThree.forEach(couple => {
        expect(couple.matchesWon).toBe(2)
      })
      
      // Correct ranking based on our 5-tier algorithm:
      // 1. couple2: 2 wins, +12 games difference, 620 player score
      // 2. couple3: 2 wins, +12 games difference, 570 player score (same games diff as couple2, but lower player score)
      // 3. couple1: 2 wins, 0 games difference, 750 player score (worse games diff than couple2/couple3) 
      // 4. couple4: 0 wins, -24 games difference
      expect(rankedCouples[0].coupleId).toBe('couple2') // Best games diff + player score tiebreaker
      expect(rankedCouples[1].coupleId).toBe('couple3') // Same games diff as couple2, lower player score
      expect(rankedCouples[2].coupleId).toBe('couple1') // Worse games diff despite highest player score
      expect(rankedCouples[3].coupleId).toBe('couple4') // Lowest wins
    })
    
    it('should handle incomplete zone (missing matches)', () => {
      const { couples } = createIntegrationData()
      const partialMatches = [
        {
          id: 'match1',
          couple1_id: 'couple1',
          couple2_id: 'couple2',
          result_couple1: 2,
          result_couple2: 1,
          winner_id: 'couple1',
          status: 'FINISHED',
          zone_id: 'zone1'
        }
      ]
      
      const calculator = new ZoneStatsCalculator()
      const engine = new ZoneRankingEngine()
      
      const coupleStats = calculator.calculateAllCoupleStats(couples, partialMatches)
      const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, partialMatches)
      const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
      
      // Should still produce valid ranking
      expect(engine.validateRanking(rankedCouples)).toBe(true)
      
      // couple1 should be first (only winner)
      expect(rankedCouples[0].coupleId).toBe('couple1')
      expect(rankedCouples[0].matchesWon).toBe(1)
      
      // Among the 0-win couples, order determined by games difference first, then player scores:
      // couple3: 0 games diff, 570 player score (best games diff among 0-win couples)
      // couple4: 0 games diff, 510 player score (same games diff as couple3, lower player score)
      // couple2: -6 games diff, 620 player score (worst games diff among 0-win couples)
      expect(rankedCouples[1].coupleId).toBe('couple3') // Best games diff among 0-win couples, higher player score than couple4
      expect(rankedCouples[1].matchesPlayed).toBe(0)
      
      expect(rankedCouples[2].coupleId).toBe('couple4') // Same games diff as couple3, lower player score
      expect(rankedCouples[2].matchesPlayed).toBe(0)
      
      expect(rankedCouples[3].coupleId).toBe('couple2') // Worst games diff among 0-win couples  
      expect(rankedCouples[3].matchesLost).toBe(1)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle zone with single couple', () => {
      const couples = [
        {
          id: 'couple1',
          player1_id: 'p1',
          player2_id: 'p2',
          player1: { id: 'p1', first_name: 'John', last_name: 'Doe', score: 300 },
          player2: { id: 'p2', first_name: 'Jane', last_name: 'Smith', score: 300 }
        }
      ]
      const matches: MatchData[] = []
      
      const calculator = new ZoneStatsCalculator()
      const engine = new ZoneRankingEngine()
      
      const coupleStats = calculator.calculateAllCoupleStats(couples, matches)
      const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, matches)
      const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
      
      expect(rankedCouples).toHaveLength(1)
      expect(rankedCouples[0].position).toBe(1)
      expect(rankedCouples[0].coupleId).toBe('couple1')
    })
    
    it('should handle zone with no couples', () => {
      const couples: CoupleData[] = []
      const matches: MatchData[] = []
      
      const calculator = new ZoneStatsCalculator()
      const engine = new ZoneRankingEngine()
      
      const coupleStats = calculator.calculateAllCoupleStats(couples, matches)
      const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, matches)
      const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
      
      expect(rankedCouples).toHaveLength(0)
      expect(engine.validateRanking(rankedCouples)).toBe(true)
    })
    
    it('should handle matches with zero scores', () => {
      const couples = [
        {
          id: 'couple1',
          player1_id: 'p1',
          player2_id: 'p2',
          player1: { id: 'p1', first_name: 'John', last_name: 'Doe', score: 300 },
          player2: { id: 'p2', first_name: 'Jane', last_name: 'Smith', score: 300 }
        },
        {
          id: 'couple2',
          player1_id: 'p3',
          player2_id: 'p4',
          player1: { id: 'p3', first_name: 'Bob', last_name: 'Wilson', score: 300 },
          player2: { id: 'p4', first_name: 'Alice', last_name: 'Brown', score: 300 }
        }
      ]
      const matches = [
        {
          id: 'match1',
          couple1_id: 'couple1',
          couple2_id: 'couple2',
          result_couple1: 2,
          result_couple2: 0, // Zero score
          winner_id: 'couple1',
          status: 'FINISHED',
          zone_id: 'zone1'
        }
      ]
      
      const calculator = new ZoneStatsCalculator()
      const engine = new ZoneRankingEngine()
      
      const coupleStats = calculator.calculateAllCoupleStats(couples, matches)
      const headToHeadMatrix = calculator.createHeadToHeadMatrix(couples, matches)
      const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
      
      expect(engine.validateRanking(rankedCouples)).toBe(true)
      expect(rankedCouples[0].coupleId).toBe('couple1')
      expect(rankedCouples[1].coupleId).toBe('couple2')
      
      const winner = rankedCouples[0]
      const loser = rankedCouples[1]
      
      expect(winner.setsWon).toBe(2)
      expect(winner.setsLost).toBe(0)
      expect(loser.setsWon).toBe(0)
      expect(loser.setsLost).toBe(2)
    })
  })
})