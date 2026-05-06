/**
 * Tests for ZoneRankingEngine
 */

import { ZoneRankingEngine } from '../zone-ranking-engine'
import { TiebreakReason } from '../types'
import type { CoupleStats, HeadToHeadResult } from '../types'

describe('ZoneRankingEngine', () => {
  let engine: ZoneRankingEngine
  
  beforeEach(() => {
    engine = new ZoneRankingEngine()
  })
  
  const createMockCoupleStats = (
    id: string,
    matchesWon: number,
    gamesDiff: number,
    playerScore: number = 600
  ): CoupleStats => ({
    coupleId: id,
    player1Name: 'Player1',
    player2Name: 'Player2',
    player1Score: playerScore / 2,
    player2Score: playerScore / 2,
    totalPlayerScore: playerScore,
    matchesWon,
    matchesLost: 2 - matchesWon,
    matchesPlayed: 2,
    setsWon: 3,
    setsLost: 2,
    setsDifference: 1,
    gamesWon: 36 + gamesDiff,
    gamesLost: 36,
    gamesDifference: gamesDiff,
    position: 0,
    positionTieInfo: ''
  })
  
  const createHeadToHead = (
    coupleAId: string,
    coupleBId: string,
    winnerCoupleId: string | null = null,
    matchPlayed: boolean = false
  ): HeadToHeadResult => ({
    coupleAId,
    coupleBId,
    winnerCoupleId,
    matchPlayed
  })
  
  describe('rankCouplesByAllCriteria', () => {
    it('should rank couples by matches won (no ties)', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 0), // 1 win
        createMockCoupleStats('couple2', 2, 0), // 2 wins
        createMockCoupleStats('couple3', 0, 0)  // 0 wins
      ]
      const headToHead: HeadToHeadResult[] = []
      
      const ranked = engine.rankCouplesByAllCriteria(couples, headToHead)
      
      expect(ranked).toHaveLength(3)
      expect(ranked[0].coupleId).toBe('couple2') // 2 wins - 1st
      expect(ranked[0].position).toBe(1)
      expect(ranked[1].coupleId).toBe('couple1') // 1 win - 2nd  
      expect(ranked[1].position).toBe(2)
      expect(ranked[2].coupleId).toBe('couple3') // 0 wins - 3rd
      expect(ranked[2].position).toBe(3)
    })
    
    it('should resolve two-way tie by head-to-head', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 0, 600),
        createMockCoupleStats('couple2', 1, 0, 600) // Same wins, same games diff, same player score
      ]
      const headToHead = [
        createHeadToHead('couple1', 'couple2', 'couple1', true), // couple1 beat couple2
        createHeadToHead('couple2', 'couple1', 'couple1', true)
      ]
      
      const ranked = engine.rankCouplesByAllCriteria(couples, headToHead)
      
      expect(ranked[0].coupleId).toBe('couple1') // Winner of head-to-head
      expect(ranked[0].position).toBe(1)
      expect(ranked[1].coupleId).toBe('couple2')
      expect(ranked[1].position).toBe(2)
      expect(ranked[0].positionTieInfo).toContain('head-to-head')
    })
    
    it('should resolve two-way tie by games difference when no head-to-head', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 5, 600), // Better games difference
        createMockCoupleStats('couple2', 1, 2, 600)  // Worse games difference
      ]
      const headToHead = [
        createHeadToHead('couple1', 'couple2', null, false), // No match played
        createHeadToHead('couple2', 'couple1', null, false)
      ]
      
      const ranked = engine.rankCouplesByAllCriteria(couples, headToHead)
      
      expect(ranked[0].coupleId).toBe('couple1') // Better games difference
      expect(ranked[0].position).toBe(1)
      expect(ranked[1].coupleId).toBe('couple2')
      expect(ranked[1].position).toBe(2)
      expect(ranked[0].positionTieInfo).toContain('games difference')
    })
    
    it('should resolve two-way tie by player scores', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 3, 700), // Higher player scores
        createMockCoupleStats('couple2', 1, 3, 600)  // Lower player scores
      ]
      const headToHead = [
        createHeadToHead('couple1', 'couple2', null, false),
        createHeadToHead('couple2', 'couple1', null, false)
      ]
      
      const ranked = engine.rankCouplesByAllCriteria(couples, headToHead)
      
      expect(ranked[0].coupleId).toBe('couple1') // Higher player scores
      expect(ranked[0].position).toBe(1)
      expect(ranked[1].coupleId).toBe('couple2')
      expect(ranked[1].position).toBe(2)
      expect(ranked[0].positionTieInfo).toContain('player scores')
    })
    
    it('should use random tiebreaker for perfect tie', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 3, 600), // Perfect tie
        createMockCoupleStats('couple2', 1, 3, 600)  // Perfect tie
      ]
      const headToHead = [
        createHeadToHead('couple1', 'couple2', null, false),
        createHeadToHead('couple2', 'couple1', null, false)
      ]
      
      const ranked = engine.rankCouplesByAllCriteria(couples, headToHead)
      
      expect(ranked).toHaveLength(2)
      expect(ranked[0].position).toBe(1)
      expect(ranked[1].position).toBe(2)
      expect(ranked[0].positionTieInfo).toContain('random tiebreaker')
    })
  })
  
  describe('resolveTwoWayTie', () => {
    it('should throw error for wrong number of couples', () => {
      const couples = [createMockCoupleStats('couple1', 1, 0)]
      const headToHead: HeadToHeadResult[] = []
      
      expect(() => {
        engine.resolveTwoWayTie(couples, headToHead)
      }).toThrow('resolveTwoWayTie requires exactly 2 couples')
    })
    
    it('should resolve by head-to-head when match was played', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 0),
        createMockCoupleStats('couple2', 1, 0)
      ]
      const headToHead = [
        createHeadToHead('couple1', 'couple2', 'couple2', true) // couple2 won
      ]
      
      const result = engine.resolveTwoWayTie(couples, headToHead)
      
      expect(result[0].coupleId).toBe('couple2') // Winner first
      expect(result[1].coupleId).toBe('couple1')
    })
  })
  
  describe('resolveMultiWayTie', () => {
    it('should throw error for less than 3 couples', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 0),
        createMockCoupleStats('couple2', 1, 0)
      ]
      const headToHead: HeadToHeadResult[] = []
      
      expect(() => {
        engine.resolveMultiWayTie(couples, headToHead)
      }).toThrow('resolveMultiWayTie requires 3 or more couples')
    })
    
    it('should resolve multi-way tie by games difference', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 1, 600), // Games diff: 1
        createMockCoupleStats('couple2', 1, 3, 600), // Games diff: 3 (best)
        createMockCoupleStats('couple3', 1, 2, 600)  // Games diff: 2
      ]
      const headToHead: HeadToHeadResult[] = []
      
      const result = engine.resolveMultiWayTie(couples, headToHead)
      
      expect(result[0].coupleId).toBe('couple2') // Best games diff
      expect(result[1].coupleId).toBe('couple3') // Second best
      expect(result[2].coupleId).toBe('couple1') // Worst
    })
    
    it('should resolve multi-way tie with sub-ties by player scores', () => {
      const couples = [
        createMockCoupleStats('couple1', 1, 3, 700), // Same games diff, higher player score
        createMockCoupleStats('couple2', 1, 3, 600), // Same games diff, lower player score  
        createMockCoupleStats('couple3', 1, 1, 500)  // Worse games diff
      ]
      const headToHead: HeadToHeadResult[] = []
      
      const result = engine.resolveMultiWayTie(couples, headToHead)
      
      expect(result[0].coupleId).toBe('couple1') // Best games diff + player score
      expect(result[1].coupleId).toBe('couple2') // Same games diff, lower score
      expect(result[2].coupleId).toBe('couple3') // Worst games diff
    })
  })
  
  describe('validateRanking', () => {
    it('should validate correct ranking', () => {
      const couples = [
        { ...createMockCoupleStats('couple1', 2, 0), position: 1 },
        { ...createMockCoupleStats('couple2', 1, 0), position: 2 },
        { ...createMockCoupleStats('couple3', 0, 0), position: 3 }
      ]
      
      const isValid = engine.validateRanking(couples)
      
      expect(isValid).toBe(true)
    })
    
    it('should detect invalid position sequence', () => {
      const couples = [
        { ...createMockCoupleStats('couple1', 2, 0), position: 1 },
        { ...createMockCoupleStats('couple2', 1, 0), position: 3 }, // Should be 2
        { ...createMockCoupleStats('couple3', 0, 0), position: 4 }  // Should be 3
      ]
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const isValid = engine.validateRanking(couples)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Invalid position 3 at index 1')
      
      consoleSpy.mockRestore()
    })
    
    it('should detect duplicate positions', () => {
      const couples = [
        { ...createMockCoupleStats('couple1', 2, 0), position: 1 },
        { ...createMockCoupleStats('couple2', 1, 0), position: 1 }, // Duplicate!
        { ...createMockCoupleStats('couple3', 0, 0), position: 3 }
      ]
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const isValid = engine.validateRanking(couples)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalled() // Just check it was called with some error
      
      consoleSpy.mockRestore()
    })
    
    it('should detect invalid ranking order', () => {
      const couples = [
        { ...createMockCoupleStats('couple1', 1, 0), position: 1 }, // Fewer wins but ranked higher
        { ...createMockCoupleStats('couple2', 2, 0), position: 2 }  // More wins but ranked lower
      ]
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const isValid = engine.validateRanking(couples)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid ranking order: couple at position 1 has fewer wins than position 2'
      )
      
      consoleSpy.mockRestore()
    })
  })
})