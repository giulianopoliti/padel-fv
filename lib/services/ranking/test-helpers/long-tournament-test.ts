/**
 * LONG TOURNAMENT TEST HELPERS
 * 
 * ⚠️  DEVELOPMENT ONLY: These helpers are for testing the LONG tournament ranking system
 * ⚠️  DO NOT USE IN PRODUCTION: These functions create test data
 * 
 * Purpose: Test the complete LONG tournament ranking flow with real data
 */

import { createClient } from '@/utils/supabase/server'

export interface TestMatchResult {
  matchId: string
  couple1Name: string
  couple2Name: string
  sets: {
    couple1Games: number
    couple2Games: number
  }[]
  winner: string
}

/**
 * Test the LONG tournament ranking system with sample data
 */
export async function testLongTournamentRanking(
  tournamentId: string,
  zoneId: string
): Promise<{
  success: boolean
  results?: any
  error?: string
}> {
  try {
    // Import the functions we need to test
    const { updateZonePositionsForTournament } = await import('../../../zone-position/tournament-zone-dispatcher')
    
    console.log(`🧪 Testing LONG tournament ranking system`)
    console.log(`   Tournament: ${tournamentId}`)
    console.log(`   Zone: ${zoneId}`)
    
    // Test the complete ranking calculation
    const result = await updateZonePositionsForTournament(tournamentId, zoneId)
    
    if (result.success) {
      console.log(`✅ Test passed!`)
      console.log(`   System used: ${result.systemUsed}`)
      console.log(`   Updated couples: ${result.updatedCouples}`)
      console.log(`   Applied criteria: ${result.appliedCriteria.join(', ')}`)
      console.log(`   Calculation time: ${result.calculationTime}ms`)
      
      if (result.hasUnresolvedTies) {
        console.warn(`⚠️  Unresolved ties detected`)
      }
      
      return {
        success: true,
        results: result
      }
    } else {
      console.error(`❌ Test failed: ${result.error}`)
      return {
        success: false,
        error: result.error
      }
    }
    
  } catch (error) {
    console.error(`❌ Test error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown test error'
    }
  }
}

/**
 * Create sample set_matches data for testing
 */
export async function createSampleSetMatchesData(
  matchId: string,
  sets: { couple1Games: number, couple2Games: number }[]
): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    // Get match info to determine couple IDs
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('couple1_id, couple2_id')
      .eq('id', matchId)
      .single()
    
    if (matchError || !match) {
      console.error('Failed to get match info:', matchError?.message)
      return false
    }
    
    // Delete existing set_matches for this match
    await supabase
      .from('set_matches')
      .delete()
      .eq('match_id', matchId)
    
    // Create set_matches records
    const setMatches = sets.map((set, index) => ({
      match_id: matchId,
      set_number: index + 1,
      couple1_games: set.couple1Games,
      couple2_games: set.couple2Games,
      winner_couple_id: set.couple1Games > set.couple2Games 
        ? match.couple1_id 
        : match.couple2_id,
      status: 'COMPLETED'
    }))
    
    const { error: insertError } = await supabase
      .from('set_matches')
      .insert(setMatches)
    
    if (insertError) {
      console.error('Failed to insert set_matches:', insertError.message)
      return false
    }
    
    // Update matches table with sets results
    const couple1Sets = sets.filter(set => set.couple1Games > set.couple2Games).length
    const couple2Sets = sets.filter(set => set.couple2Games > set.couple1Games).length
    
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        result_couple1: couple1Sets.toString(),
        result_couple2: couple2Sets.toString(),
        winner_id: couple1Sets > couple2Sets ? match.couple1_id : match.couple2_id,
        status: 'FINISHED'
      })
      .eq('id', matchId)
    
    if (updateError) {
      console.error('Failed to update match:', updateError.message)
      return false
    }
    
    console.log(`✅ Created sample set_matches data for match ${matchId}`)
    console.log(`   Sets: ${couple1Sets}-${couple2Sets}`)
    console.log(`   Games: ${sets.map(s => `${s.couple1Games}-${s.couple2Games}`).join(', ')}`)
    
    return true
    
  } catch (error) {
    console.error('Error creating sample data:', error)
    return false
  }
}

/**
 * Get current zone positions for inspection
 */
export async function inspectZonePositions(zoneId: string): Promise<any[]> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('zone_positions')
      .select(`
        position,
        wins,
        losses,
        sets_for,
        sets_against,
        sets_difference,
        games_for,
        games_against,
        games_difference,
        player_score_total,
        tie_info,
        calculated_at,
        couples (
          player1:players!couples_player1_id_fkey (first_name, last_name),
          player2:players!couples_player2_id_fkey (first_name, last_name)
        )
      `)
      .eq('zone_id', zoneId)
      .order('position', { ascending: true })
    
    if (error) {
      console.error('Failed to inspect zone positions:', error.message)
      return []
    }
    
    console.log(`📊 Current zone positions for zone ${zoneId}:`)
    
    data?.forEach(pos => {
      const couple1Name = `${pos.couples.player1.first_name} ${pos.couples.player1.last_name}`
      const couple2Name = `${pos.couples.player2.first_name} ${pos.couples.player2.last_name}`
      
      console.log(`   ${pos.position}. ${couple1Name} / ${couple2Name}`)
      console.log(`      Matches: ${pos.wins}W-${pos.losses}L`)
      console.log(`      Sets: ${pos.sets_for}-${pos.sets_against} (${pos.sets_difference >= 0 ? '+' : ''}${pos.sets_difference})`)
      console.log(`      Games: ${pos.games_for}-${pos.games_against} (${pos.games_difference >= 0 ? '+' : ''}${pos.games_difference})`)
      console.log(`      Player scores: ${pos.player_score_total}`)
      if (pos.tie_info) {
        console.log(`      Tiebreak: ${pos.tie_info}`)
      }
      console.log(`      Updated: ${new Date(pos.calculated_at).toLocaleString()}`)
      console.log('')
    })
    
    return data || []
    
  } catch (error) {
    console.error('Error inspecting zone positions:', error)
    return []
  }
}

/**
 * Complete test flow: Create sample data + test ranking + inspect results
 */
export async function runCompleteTest(
  tournamentId: string,
  zoneId: string,
  testMatches: {
    matchId: string
    sets: { couple1Games: number, couple2Games: number }[]
  }[]
): Promise<void> {
  console.log(`🚀 Running complete LONG tournament ranking test`)
  console.log(`   Tournament: ${tournamentId}`)
  console.log(`   Zone: ${zoneId}`)
  console.log(`   Test matches: ${testMatches.length}`)
  console.log('')
  
  // Step 1: Create sample data
  for (const testMatch of testMatches) {
    const success = await createSampleSetMatchesData(testMatch.matchId, testMatch.sets)
    if (!success) {
      console.error(`❌ Failed to create sample data for match ${testMatch.matchId}`)
      return
    }
  }
  
  console.log(`✅ Sample data created for ${testMatches.length} matches`)
  console.log('')
  
  // Step 2: Test ranking system
  const testResult = await testLongTournamentRanking(tournamentId, zoneId)
  if (!testResult.success) {
    console.error(`❌ Ranking test failed: ${testResult.error}`)
    return
  }
  
  console.log('')
  
  // Step 3: Inspect final results
  await inspectZonePositions(zoneId)
  
  console.log(`🎉 Complete test finished successfully!`)
}