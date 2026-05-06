/**
 * Tests for ZoneStatsCalculator
 */

import { ZoneStatsCalculator } from '../zone-stats-calculator'
import type { CoupleData, MatchData } from '../types'

describe('ZoneStatsCalculator', () => {
  let calculator: ZoneStatsCalculator
  
  beforeEach(() => {
    calculator = new ZoneStatsCalculator()
  })
  
  const createMockCouple = (id: string, p1Name: string, p2Name: string, p1Score = 300, p2Score = 300): CoupleData => ({
    id,
    player1_id: `${id}_p1`,
    player2_id: `${id}_p2`,
    player1: {
      id: `${id}_p1`,
      first_name: p1Name.split(' ')[0],
      last_name: p1Name.split(' ')[1] || '',
      score: p1Score
    },
    player2: {
      id: `${id}_p2`,
      first_name: p2Name.split(' ')[0],
      last_name: p2Name.split(' ')[1] || '',
      score: p2Score
    }
  })
  
  const createMockMatch = (
    id: string, 
    couple1Id: string, 
    couple2Id: string, 
    result1: number, 
    result2: number,
    winnerId: string
  ): MatchData => ({
    id,
    couple1_id: couple1Id,
    couple2_id: couple2Id,
    result_couple1: result1,
    result_couple2: result2,
    winner_id: winnerId,
    status: 'FINISHED',
    zone_id: 'zone1'
  })
  
  describe('calculateIndividualStats', () => {
    it('should calculate correct stats for a couple with no matches', () => {
      const couple = createMockCouple('couple1', 'John Doe', 'Jane Smith', 400, 350)
      const matches: MatchData[] = []
      
      const stats = calculator.calculateIndividualStats(couple, matches)
      
      expect(stats).toEqual({
        coupleId: 'couple1',
        player1Name: 'John Doe',
        player2Name: 'Jane Smith',
        player1Score: 400,
        player2Score: 350,
        totalPlayerScore: 750,
        matchesWon: 0,
        matchesLost: 0,
        matchesPlayed: 0,
        setsWon: 0,
        setsLost: 0,
        setsDifference: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDifference: 0,
        position: 0,
        positionTieInfo: ''
      })
    })
    
    it('should calculate correct stats for a couple with wins and losses', () => {
      const couple1 = createMockCouple('couple1', 'John Doe', 'Jane Smith')
      const matches = [
        createMockMatch('match1', 'couple1', 'couple2', 2, 1, 'couple1'), // Win: 2-1
        createMockMatch('match2', 'couple3', 'couple1', 1, 2, 'couple1'), // Win: 2-1 (couple1 is couple2 in match)
        createMockMatch('match3', 'couple1', 'couple4', 1, 2, 'couple4')  // Loss: 1-2
      ]
      
      const stats = calculator.calculateIndividualStats(couple1, matches)
      
      expect(stats.matchesWon).toBe(2)
      expect(stats.matchesLost).toBe(1)
      expect(stats.matchesPlayed).toBe(3)
      expect(stats.setsWon).toBe(5) // 2 + 2 + 1
      expect(stats.setsLost).toBe(4) // 1 + 1 + 2
      expect(stats.setsDifference).toBe(1) // 5 - 4
    })
    
    it('should handle matches with null results', () => {
      const couple = createMockCouple('couple1', 'John Doe', 'Jane Smith')
      const matches = [
        {
          id: 'match1',
          couple1_id: 'couple1',
          couple2_id: 'couple2',
          result_couple1: null,
          result_couple2: null,
          winner_id: null,
          status: 'FINISHED',
          zone_id: 'zone1'
        }
      ]
      
      const stats = calculator.calculateIndividualStats(couple, matches)
      
      expect(stats.matchesPlayed).toBe(0)
      expect(stats.matchesWon).toBe(0)
      expect(stats.matchesLost).toBe(0)
    })
  })
  
  describe('calculateAllCoupleStats', () => {
    it('should calculate stats for all couples', () => {
      const couples = [
        createMockCouple('couple1', 'John Doe', 'Jane Smith', 400, 350),
        createMockCouple('couple2', 'Bob Wilson', 'Alice Brown', 300, 320)
      ]
      const matches = [
        createMockMatch('match1', 'couple1', 'couple2', 2, 1, 'couple1')
      ]
      
      const allStats = calculator.calculateAllCoupleStats(couples, matches)
      
      expect(allStats).toHaveLength(2)
      expect(allStats[0].coupleId).toBe('couple1')
      expect(allStats[0].matchesWon).toBe(1)
      expect(allStats[1].coupleId).toBe('couple2')
      expect(allStats[1].matchesLost).toBe(1)
    })
  })
  
  describe('createHeadToHeadMatrix', () => {
    it('should create complete head-to-head matrix', () => {
      const couples = [
        createMockCouple('couple1', 'John', 'Jane'),
        createMockCouple('couple2', 'Bob', 'Alice')
      ]
      const matches = [
        createMockMatch('match1', 'couple1', 'couple2', 2, 1, 'couple1')
      ]
      
      const matrix = calculator.createHeadToHeadMatrix(couples, matches)
      
      expect(matrix).toHaveLength(2) // 2 couples = 2 comparisons (A->B, B->A)
      
      const couple1VsCouple2 = matrix.find(h => h.coupleAId === 'couple1' && h.coupleBId === 'couple2')
      expect(couple1VsCouple2).toBeDefined()
      expect(couple1VsCouple2?.matchPlayed).toBe(true)
      expect(couple1VsCouple2?.winnerCoupleId).toBe('couple1')
      
      const couple2VsCouple1 = matrix.find(h => h.coupleAId === 'couple2' && h.coupleBId === 'couple1')
      expect(couple2VsCouple1).toBeDefined()
      expect(couple2VsCouple1?.matchPlayed).toBe(true)
      expect(couple2VsCouple1?.winnerCoupleId).toBe('couple1')
    })
    
    it('should handle unplayed matches', () => {
      const couples = [
        createMockCouple('couple1', 'John', 'Jane'),
        createMockCouple('couple2', 'Bob', 'Alice')
      ]
      const matches: MatchData[] = []
      
      const matrix = calculator.createHeadToHeadMatrix(couples, matches)
      
      expect(matrix).toHaveLength(2)
      matrix.forEach(h2h => {
        expect(h2h.matchPlayed).toBe(false)
        expect(h2h.winnerCoupleId).toBe(null)
      })
    })
  })
  
  describe('findHeadToHeadMatch', () => {
    it('should find match between specific couples', () => {
      const matches = [
        createMockMatch('match1', 'couple1', 'couple2', 2, 1, 'couple1'),
        createMockMatch('match2', 'couple3', 'couple4', 2, 0, 'couple3')
      ]
      
      const result = calculator.findHeadToHeadMatch('couple1', 'couple2', matches)
      
      expect(result.matchPlayed).toBe(true)
      expect(result.winnerCoupleId).toBe('couple1')
      expect(result.couple1Score).toBe(2)
      expect(result.couple2Score).toBe(1)
    })
    
    it('should find match regardless of couple order in match data', () => {
      const matches = [
        createMockMatch('match1', 'couple2', 'couple1', 1, 2, 'couple1')
      ]
      
      const result = calculator.findHeadToHeadMatch('couple1', 'couple2', matches)
      
      expect(result.matchPlayed).toBe(true)
      expect(result.winnerCoupleId).toBe('couple1')
      expect(result.couple1Score).toBe(2) // couple1's score
      expect(result.couple2Score).toBe(1) // couple2's score
    })
    
    it('should return null match for unplayed couples', () => {
      const matches = [
        createMockMatch('match1', 'couple3', 'couple4', 2, 1, 'couple3')
      ]
      
      const result = calculator.findHeadToHeadMatch('couple1', 'couple2', matches)
      
      expect(result.matchPlayed).toBe(false)
      expect(result.winnerCoupleId).toBe(null)
      expect(result.couple1Score).toBeUndefined()
      expect(result.couple2Score).toBeUndefined()
    })
  })
})