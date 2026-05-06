/**
 * Tests for utility functions
 */

import { 
  groupCouplesByProperty, 
  sortCouplesByMultipleCriteria,
  secureRandomShuffle,
  createTieInfo,
  validateCoupleStats
} from '../utils'
import { TiebreakReason } from '../types'
import type { CoupleStats } from '../types'

describe('Utils', () => {
  
  const createMockStats = (id: string, wins: number, games: number, score: number): CoupleStats => ({
    coupleId: id,
    player1Name: 'P1',
    player2Name: 'P2',
    player1Score: score / 2,
    player2Score: score / 2,
    totalPlayerScore: score,
    matchesWon: wins,
    matchesLost: 2 - wins,
    matchesPlayed: 2,
    setsWon: 3,
    setsLost: 2,
    setsDifference: 1,
    gamesWon: 36 + games,
    gamesLost: 36,
    gamesDifference: games,
    position: 0,
    positionTieInfo: ''
  })
  
  describe('groupCouplesByProperty', () => {
    it('should group couples by property value', () => {
      const couples = [
        createMockStats('c1', 2, 0, 600), // 2 wins
        createMockStats('c2', 1, 0, 600), // 1 win
        createMockStats('c3', 2, 0, 600), // 2 wins  
        createMockStats('c4', 0, 0, 600)  // 0 wins
      ]
      
      const groups = groupCouplesByProperty(couples, c => c.matchesWon)
      
      expect(groups).toHaveLength(3) // 3 different win counts
      expect(groups[0]).toHaveLength(2) // 2 couples with 2 wins
      expect(groups[1]).toHaveLength(1) // 1 couple with 1 win
      expect(groups[2]).toHaveLength(1) // 1 couple with 0 wins
      
      // Should be sorted descending by wins
      expect(groups[0][0].matchesWon).toBe(2)
      expect(groups[1][0].matchesWon).toBe(1)
      expect(groups[2][0].matchesWon).toBe(0)
    })
    
    it('should handle empty array', () => {
      const groups = groupCouplesByProperty([], c => c.matchesWon)
      expect(groups).toHaveLength(0)
    })
    
    it('should handle single group', () => {
      const couples = [
        createMockStats('c1', 1, 0, 600),
        createMockStats('c2', 1, 0, 600)
      ]
      
      const groups = groupCouplesByProperty(couples, c => c.matchesWon)
      expect(groups).toHaveLength(1)
      expect(groups[0]).toHaveLength(2)
    })
  })
  
  describe('sortCouplesByMultipleCriteria', () => {
    it('should sort by multiple criteria in descending order', () => {
      const couples = [
        createMockStats('c1', 1, 2, 500), // 1 win, 2 games diff, 500 score
        createMockStats('c2', 2, 1, 400), // 2 wins, 1 games diff, 400 score
        createMockStats('c3', 1, 3, 600)  // 1 win, 3 games diff, 600 score
      ]
      
      const sorted = sortCouplesByMultipleCriteria(couples, [
        c => c.matchesWon,      // Primary: wins
        c => c.gamesDifference, // Secondary: games difference
        c => c.totalPlayerScore // Tertiary: player score
      ])
      
      // c2 should be first (most wins)
      expect(sorted[0].coupleId).toBe('c2')
      
      // Between c1 and c3 (both have 1 win), c3 should be second (better games diff)
      expect(sorted[1].coupleId).toBe('c3')
      expect(sorted[2].coupleId).toBe('c1')
    })
    
    it('should not modify original array', () => {
      const couples = [
        createMockStats('c1', 1, 0, 600),
        createMockStats('c2', 2, 0, 600)
      ]
      const original = [...couples]
      
      const sorted = sortCouplesByMultipleCriteria(couples, [c => c.matchesWon])
      
      expect(couples).toEqual(original) // Original unchanged
      expect(sorted).not.toBe(couples) // Different array
    })
  })
  
  describe('secureRandomShuffle', () => {
    it('should return array with same elements', () => {
      const original = ['a', 'b', 'c', 'd']
      const shuffled = secureRandomShuffle(original)
      
      expect(shuffled).toHaveLength(original.length)
      expect(shuffled.sort()).toEqual(original.sort()) // Same elements
      expect(shuffled).not.toBe(original) // Different array reference
    })
    
    it('should not modify original array', () => {
      const original = ['a', 'b', 'c']
      const originalCopy = [...original]
      
      secureRandomShuffle(original)
      
      expect(original).toEqual(originalCopy)
    })
    
    it('should handle empty array', () => {
      const shuffled = secureRandomShuffle([])
      expect(shuffled).toEqual([])
    })
    
    it('should handle single element', () => {
      const shuffled = secureRandomShuffle(['only'])
      expect(shuffled).toEqual(['only'])
    })
    
    it('should use Math.random as fallback when crypto is unavailable', () => {
      // Mock crypto to be undefined
      const originalCrypto = global.crypto
      delete (global as any).crypto
      
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      
      const result = secureRandomShuffle(['a', 'b'])
      
      expect(mathRandomSpy).toHaveBeenCalled()
      expect(result).toHaveLength(2)
      
      // Restore
      global.crypto = originalCrypto
      mathRandomSpy.mockRestore()
    })
  })
  
  describe('createTieInfo', () => {
    it('should create appropriate tie info for each reason', () => {
      expect(createTieInfo(TiebreakReason.NO_TIE)).toBe(
        'Clear position based on matches won'
      )
      
      expect(createTieInfo(TiebreakReason.HEAD_TO_HEAD, { opponent: 'couple2' })).toBe(
        'Resolved by head-to-head result vs couple2'
      )
      
      expect(createTieInfo(TiebreakReason.GAMES_DIFFERENCE, { gamesDiff: 5 })).toBe(
        'Resolved by games difference: 5'
      )
      
      expect(createTieInfo(TiebreakReason.PLAYER_SCORES, { playerScore: 650 })).toBe(
        'Resolved by player scores total: 650'
      )
      
      expect(createTieInfo(TiebreakReason.RANDOM_TIEBREAKER)).toBe(
        'Resolved by random tiebreaker (perfect tie)'
      )
    })
    
    it('should handle missing additional info', () => {
      expect(createTieInfo(TiebreakReason.HEAD_TO_HEAD)).toBe(
        'Resolved by head-to-head result'
      )
      
      expect(createTieInfo(TiebreakReason.GAMES_DIFFERENCE)).toBe(
        'Resolved by games difference: N/A'
      )
      
      expect(createTieInfo(TiebreakReason.PLAYER_SCORES)).toBe(
        'Resolved by player scores total: N/A'
      )
    })
  })
  
  describe('validateCoupleStats', () => {
    it('should validate correct stats', () => {
      const stats = createMockStats('c1', 2, 3, 600)
      expect(validateCoupleStats(stats)).toBe(true)
    })
    
    it('should detect inconsistent match counts', () => {
      const stats = createMockStats('c1', 2, 3, 600)
      stats.matchesPlayed = 5 // Inconsistent with won + lost = 4
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const isValid = validateCoupleStats(stats)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Inconsistent match counts for couple c1')
      
      consoleSpy.mockRestore()
    })
    
    it('should detect inconsistent sets difference', () => {
      const stats = createMockStats('c1', 2, 3, 600)
      stats.setsDifference = 10 // Inconsistent with setsWon - setsLost = 1
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const isValid = validateCoupleStats(stats)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Inconsistent sets difference for couple c1')
      
      consoleSpy.mockRestore()
    })
    
    it('should detect inconsistent games difference', () => {
      const stats = createMockStats('c1', 2, 3, 600)
      stats.gamesDifference = 10 // Inconsistent with gamesWon - gamesLost = 3
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const isValid = validateCoupleStats(stats)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Inconsistent games difference for couple c1')
      
      consoleSpy.mockRestore()
    })
    
    it('should detect inconsistent player score total', () => {
      const stats = createMockStats('c1', 2, 3, 600)
      stats.totalPlayerScore = 1000 // Inconsistent with player1Score + player2Score = 600
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      const isValid = validateCoupleStats(stats)
      
      expect(isValid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Inconsistent player score total for couple c1')
      
      consoleSpy.mockRestore()
    })
  })
})