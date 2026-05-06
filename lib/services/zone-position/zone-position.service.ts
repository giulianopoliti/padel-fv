/**
 * Zone Position Service
 * Main service that orchestrates the complete zone position calculation
 */

import { createClient } from '@/utils/supabase/server'
import type { CoupleData, MatchData, ZonePositionResult } from './types'
import { ZoneStatsCalculator } from './zone-stats-calculator'
import { ZoneRankingEngine } from './zone-ranking-engine'

export class ZonePositionService {
  private statsCalculator: ZoneStatsCalculator
  private rankingEngine: ZoneRankingEngine
  
  constructor() {
    this.statsCalculator = new ZoneStatsCalculator()
    this.rankingEngine = new ZoneRankingEngine()
  }
  
  /**
   * Calculates positions for all couples in a zone
   */
  public async calculateZonePositions(zoneId: string): Promise<ZonePositionResult> {
    // Step 1: Fetch zone data from database
    const { couples, matches } = await this.fetchZoneData(zoneId)
    
    if (couples.length === 0) {
      return {
        couples: [],
        zoneCompleted: false,
        totalCouples: 0,
        calculatedAt: new Date()
      }
    }
    
    // Step 2: Calculate individual statistics
    const coupleStats = this.statsCalculator.calculateAllCoupleStats(couples, matches)
    
    // Step 3: Create head-to-head matrix
    const headToHeadMatrix = this.statsCalculator.createHeadToHeadMatrix(couples, matches)
    
    // Step 4: Rank couples by all criteria
    const rankedCouples = this.rankingEngine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)
    
    // Step 5: Validate results
    if (!this.rankingEngine.validateRanking(rankedCouples)) {
      throw new Error(`Invalid ranking calculated for zone ${zoneId}`)
    }
    
    // Step 6: Determine if zone is completed
    const zoneCompleted = this.isZoneCompleted(rankedCouples)
    
    return {
      couples: rankedCouples,
      zoneCompleted,
      totalCouples: couples.length,
      calculatedAt: new Date()
    }
  }
  
  /**
   * Updates zone positions in the database
   */
  public async updateZonePositionsInDatabase(
    tournamentId: string, 
    zoneId: string
  ): Promise<{ success: boolean; error?: string; positionsUpdated: number }> {
    try {
      const positionResult = await this.calculateZonePositions(zoneId)
      const supabase = await createClient()
      
      // Delete existing positions for this zone
      const { error: deleteError } = await supabase
        .from('zone_positions')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('zone_id', zoneId)
      
      if (deleteError) {
        return { success: false, error: deleteError.message, positionsUpdated: 0 }
      }
      
      // Insert new positions
      const positionsToInsert = positionResult.couples.map(couple => ({
        tournament_id: tournamentId,
        zone_id: zoneId,
        couple_id: couple.coupleId,
        position: couple.position,
        is_definitive: positionResult.zoneCompleted,
        points: couple.setsDifference, // Using sets difference as "points"
        wins: couple.matchesWon,
        losses: couple.matchesLost,
        games_for: couple.gamesWon,
        games_against: couple.gamesLost,
        games_difference: couple.gamesDifference,
        player_score_total: couple.totalPlayerScore,
        tie_info: couple.positionTieInfo,
        calculated_at: positionResult.calculatedAt.toISOString()
      }))
      
      const { error: insertError } = await supabase
        .from('zone_positions')
        .insert(positionsToInsert)
      
      if (insertError) {
        return { success: false, error: insertError.message, positionsUpdated: 0 }
      }
      
      return { 
        success: true, 
        positionsUpdated: positionsToInsert.length 
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        positionsUpdated: 0 
      }
    }
  }
  
  /**
   * Fetches zone data (couples and matches) from database
   */
  private async fetchZoneData(zoneId: string): Promise<{
    couples: CoupleData[]
    matches: MatchData[]
  }> {
    const supabase = await createClient()
    
    // Fetch couples in the zone
    const { data: zoneCouples, error: zoneCouplesError } = await supabase
      .from('zone_couples')
      .select(`
        couple_id,
        couples:couple_id (
          id,
          player1_id,
          player2_id,
          player1:player1_id (
            id,
            first_name,
            last_name,
            score
          ),
          player2:player2_id (
            id,
            first_name,
            last_name,
            score
          )
        )
      `)
      .eq('zone_id', zoneId)
    
    if (zoneCouplesError) {
      throw new Error(`Failed to fetch zone couples: ${zoneCouplesError.message}`)
    }
    
    // Fetch matches in the zone
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, result_couple1, result_couple2, winner_id, status, zone_id')
      .eq('zone_id', zoneId)
      .eq('status', 'FINISHED')
    
    if (matchesError) {
      throw new Error(`Failed to fetch zone matches: ${matchesError.message}`)
    }
    
    // Transform couples data
    const couples: CoupleData[] = (zoneCouples || []).map((zc: any) => {
      const couple = zc.couples
      return {
        id: couple.id,
        player1_id: couple.player1_id,
        player2_id: couple.player2_id,
        player1: Array.isArray(couple.player1) ? couple.player1[0] : couple.player1,
        player2: Array.isArray(couple.player2) ? couple.player2[0] : couple.player2
      }
    })
    
    return {
      couples,
      matches: matches || []
    }
  }
  
  /**
   * Determines if a zone is completed (all couples played all possible matches)
   */
  private isZoneCompleted(rankedCouples: any[]): boolean {
    if (rankedCouples.length <= 1) return true
    
    const expectedMatchesPerCouple = rankedCouples.length - 1
    return rankedCouples.every(couple => couple.matchesPlayed === expectedMatchesPerCouple)
  }
  
  /**
   * Calculates positions for multiple zones
   */
  public async calculateMultipleZonePositions(
    tournamentId: string,
    zoneIds: string[]
  ): Promise<Record<string, ZonePositionResult>> {
    const results: Record<string, ZonePositionResult> = {}
    
    for (const zoneId of zoneIds) {
      try {
        results[zoneId] = await this.calculateZonePositions(zoneId)
      } catch (error) {
        console.error(`Failed to calculate positions for zone ${zoneId}:`, error)
        results[zoneId] = {
          couples: [],
          zoneCompleted: false,
          totalCouples: 0,
          calculatedAt: new Date()
        }
      }
    }
    
    return results
  }
}