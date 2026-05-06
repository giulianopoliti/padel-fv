/**
 * DYNAMIC BRACKET SYSTEM - BEST PRACTICES IMPLEMENTATION
 * 
 * This system treats brackets as ALWAYS REGENERABLE and uses placeholders
 * until matches are actually played. This follows the principle:
 * "Generate bracket structure early, populate with real data when ready"
 * 
 * DESIGN PRINCIPLES:
 * 1. Brackets are ALWAYS regenerable until matches have results
 * 2. Structure is generated immediately, populated incrementally
 * 3. Zero data loss - only regenerate what hasn't been played
 * 4. Clear separation between structure and actual participants
 */

import { createClient } from "@/utils/supabase/server"
import type { Database } from '@/database.types'
import { 
  generateAlternatingBracketSeeding,
  type CoupleFromZone,
  type SeededCouple,
  type BracketPairing 
} from "../test-bracket-seeding/alternating-bracket-algorithm"

// Types for the dynamic system
type MatchStatus = Database["public"]["Enums"]["match_status"]
type RoundType = Database["public"]["Enums"]["ROUND"]

export interface DynamicBracketConfig {
  tournamentId: string
  // Always allow regeneration during zone phase
  forceRegeneration?: boolean
  // Preserve actual match results (never lose played matches)
  preservePlayedMatches?: boolean
}

export interface BracketStructure {
  bracketSize: number
  totalRounds: number
  matchesPerRound: Record<string, number>
  rounds: RoundType[]
}

export interface DynamicBracketResult {
  success: boolean
  bracketStructure?: BracketStructure
  placeholderMatches?: DatabaseMatch[]
  populatedMatches?: DatabaseMatch[]
  seededCouples?: SeededCouple[]
  stats: {
    totalMatches: number
    placeholderMatches: number
    populatedMatches: number
    playedMatches: number
    preservedResults: number
  }
  error?: string
}

export interface DatabaseMatch {
  tournament_id: string
  couple1_id: string | null
  couple2_id: string | null
  round: RoundType
  order: number
  status: MatchStatus
  winner_id: string | null
  type: 'ELIMINATION'
  court: string | null
  is_from_initial_generation: boolean
  // Metadata for dynamic system
  is_placeholder: boolean
  placeholder_info?: string
}

/**
 * CORE PRINCIPLE: Always generate bracket structure, populate when ready
 * 
 * This function implements the "Generate Early, Populate Later" pattern:
 * 1. Generate complete bracket structure immediately 
 * 2. Use placeholders for TBD participants
 * 3. Only populate with real couples when zones are complete
 * 4. Never lose played match results
 */
export async function generateDynamicBracket(
  config: DynamicBracketConfig
): Promise<DynamicBracketResult> {
  const { tournamentId, forceRegeneration = false, preservePlayedMatches = true } = config
  
  console.log(`🎾 [DynamicBracket] Starting dynamic generation for tournament ${tournamentId}`)
  console.log(`🎾 [DynamicBracket] Config: force=${forceRegeneration}, preserve=${preservePlayedMatches}`)

  try {
    // Step 1: Analyze current tournament state
    const currentState = await analyzeTournamentState(tournamentId)
    console.log(`🎾 [DynamicBracket] Current state:`, currentState)

    // Step 2: Determine bracket structure based on registrations
    const bracketStructure = await calculateOptimalBracketStructure(tournamentId)
    console.log(`🎾 [DynamicBracket] Bracket structure: ${bracketStructure.bracketSize} size`)

    // Step 3: Get zone results (if available)
    const zoneResults = await getZoneResultsIfAvailable(tournamentId)
    console.log(`🎾 [DynamicBracket] Zone results: ${zoneResults.length} couples`)

    // Step 4: Preserve existing played matches
    const existingResults = preservePlayedMatches ? 
      await getPlayedMatchResults(tournamentId) : []
    console.log(`🎾 [DynamicBracket] Preserving ${existingResults.length} played matches`)

    // Step 5: Generate dynamic bracket
    const bracketResult = await generateBracketWithPlaceholders(
      bracketStructure,
      zoneResults,
      existingResults,
      tournamentId
    )

    // Step 6: Apply to database
    const dbResult = await applyDynamicBracketToDatabase(
      bracketResult.matches,
      existingResults,
      tournamentId
    )

    if (!dbResult.success) {
      return {
        success: false,
        error: dbResult.error,
        stats: {
          totalMatches: 0,
          placeholderMatches: 0,
          populatedMatches: 0,
          playedMatches: 0,
          preservedResults: 0
        }
      }
    }

    console.log(`🎾 [DynamicBracket] ✅ Dynamic bracket generated successfully`)
    return {
      success: true,
      bracketStructure,
      placeholderMatches: bracketResult.matches.filter(m => m.is_placeholder),
      populatedMatches: bracketResult.matches.filter(m => !m.is_placeholder),
      seededCouples: bracketResult.seededCouples,
      stats: {
        totalMatches: bracketResult.matches.length,
        placeholderMatches: bracketResult.matches.filter(m => m.is_placeholder).length,
        populatedMatches: bracketResult.matches.filter(m => !m.is_placeholder).length,
        playedMatches: existingResults.length,
        preservedResults: existingResults.length
      }
    }

  } catch (error) {
    console.error(`🎾 [DynamicBracket] ❌ Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stats: {
        totalMatches: 0,
        placeholderMatches: 0,
        populatedMatches: 0,
        playedMatches: 0,
        preservedResults: 0
      }
    }
  }
}

/**
 * Analyzes current tournament state to determine what can be done
 */
async function analyzeTournamentState(tournamentId: string) {
  const supabase = await createClient()
  
  const [
    { data: tournament },
    { data: registrations },
    { data: zones },
    { data: matches }
  ] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('inscriptions').select('id').eq('tournament_id', tournamentId),
    supabase.from('zones').select('id').eq('tournament_id', tournamentId),
    supabase.from('matches').select('id, status, type').eq('tournament_id', tournamentId)
  ])

  const eliminationMatches = matches?.filter(m => m.type === 'ELIMINATION') || []
  const playedMatches = eliminationMatches.filter(m => 
    m.status === 'FINISHED' || m.status === 'IN_PROGRESS'
  )

  return {
    tournament: tournament || null,
    totalRegistrations: registrations?.length || 0,
    zonesCreated: zones?.length || 0,
    eliminationMatches: eliminationMatches.length,
    playedMatches: playedMatches.length,
    canAlwaysRegenerate: playedMatches.length === 0,
    requiresCarefulRegeneration: playedMatches.length > 0
  }
}

/**
 * Calculates optimal bracket structure based on current registrations
 */
async function calculateOptimalBracketStructure(tournamentId: string): Promise<BracketStructure> {
  const supabase = await createClient()
  
  // Get current registration count
  const { data: registrations } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('tournament_id', tournamentId)

  const totalCouples = registrations?.length || 0
  
  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, totalCouples))))
  
  // Calculate rounds
  const rounds: RoundType[] = []
  let currentSize = bracketSize
  
  while (currentSize >= 2) {
    const roundName = getRoundName(currentSize)
    rounds.push(roundName)
    currentSize = currentSize / 2
  }

  // Calculate matches per round
  const matchesPerRound: Record<string, number> = {}
  let matchCount = bracketSize / 2
  
  rounds.forEach(round => {
    matchesPerRound[round] = matchCount
    matchCount = matchCount / 2
  })

  return {
    bracketSize,
    totalRounds: rounds.length,
    matchesPerRound,
    rounds
  }
}

/**
 * Gets zone results if zones are complete, otherwise returns empty array
 */
async function getZoneResultsIfAvailable(tournamentId: string): Promise<CoupleFromZone[]> {
  const supabase = await createClient()

  try {
    // Check if zones have positions calculated
    const { data: zonePositions } = await supabase
      .from('zone_positions')
      .select(`
        position,
        total_points,
        couples:couple_id (
          id,
          player1:player1_id (first_name, last_name),
          player2:player2_id (first_name, last_name)
        ),
        zones:zone_id (
          id,
          name
        )
      `)
      .eq('zones.tournament_id', tournamentId)
      .order('zones.name')
      .order('position')

    if (!zonePositions || zonePositions.length === 0) {
      console.log(`🎾 [DynamicBracket] No zone positions available yet - using placeholders`)
      return []
    }

    // Convert to CoupleFromZone format
    const couplesFromZones: CoupleFromZone[] = zonePositions
      .filter(zp => zp.couples && zp.zones)
      .map(zp => ({
        id: zp.couples!.id,
        zoneId: zp.zones!.id,
        zoneName: zp.zones!.name || 'Unknown Zone',
        zonePosition: zp.position || 1,
        points: zp.total_points || 0,
        player1Name: zp.couples!.player1 ? 
          `${zp.couples!.player1.first_name} ${zp.couples!.player1.last_name}` : 
          'Player 1',
        player2Name: zp.couples!.player2 ? 
          `${zp.couples!.player2.first_name} ${zp.couples!.player2.last_name}` : 
          'Player 2'
      }))

    console.log(`🎾 [DynamicBracket] Found ${couplesFromZones.length} couples from completed zones`)
    return couplesFromZones

  } catch (error) {
    console.warn(`🎾 [DynamicBracket] Error getting zone results, using placeholders:`, error)
    return []
  }
}

/**
 * Gets existing played match results that must be preserved
 */
async function getPlayedMatchResults(tournamentId: string) {
  const supabase = await createClient()
  
  const { data: playedMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')
    .in('status', ['FINISHED', 'IN_PROGRESS'])

  return playedMatches || []
}

/**
 * Generates bracket with placeholders and populates with available data
 */
async function generateBracketWithPlaceholders(
  structure: BracketStructure,
  zoneResults: CoupleFromZone[],
  existingResults: any[],
  tournamentId: string
) {
  let seededCouples: SeededCouple[] = []
  let bracketPairings: BracketPairing[] = []

  // If we have zone results, use the alternating algorithm
  if (zoneResults.length > 0) {
    const algorithmResult = generateAlternatingBracketSeeding(zoneResults)
    seededCouples = algorithmResult.seededCouples
    bracketPairings = algorithmResult.bracketPairings
  }

  // Generate all bracket matches (with placeholders where needed)
  const matches: DatabaseMatch[] = []
  
  // Generate first round
  const firstRoundMatches = generateFirstRoundWithPlaceholders(
    structure,
    seededCouples,
    bracketPairings,
    tournamentId
  )
  matches.push(...firstRoundMatches)

  // Generate subsequent rounds (all placeholders initially)
  const subsequentRounds = generateSubsequentRoundsWithPlaceholders(
    structure,
    tournamentId
  )
  matches.push(...subsequentRounds)

  return {
    matches,
    seededCouples
  }
}

/**
 * Generates first round matches with real couples or placeholders
 */
function generateFirstRoundWithPlaceholders(
  structure: BracketStructure,
  seededCouples: SeededCouple[],
  bracketPairings: BracketPairing[],
  tournamentId: string
): DatabaseMatch[] {
  const matches: DatabaseMatch[] = []
  const firstRound = structure.rounds[0]
  const matchesInFirstRound = structure.matchesPerRound[firstRound]

  for (let i = 1; i <= matchesInFirstRound; i++) {
    // Try to find real pairing
    const realPairing = bracketPairings.find(p => p.order === i)
    
    if (realPairing) {
      // Real couples available
      matches.push({
        tournament_id: tournamentId,
        couple1_id: realPairing.couple1.id,
        couple2_id: realPairing.couple2?.id || null,
        round: firstRound,
        order: i,
        status: (realPairing.couple2 === null ? 'BYE' : 'PENDING') as MatchStatus,
        winner_id: realPairing.couple2 === null ? realPairing.couple1.id : null,
        type: 'ELIMINATION',
        court: null,
        is_from_initial_generation: true,
        is_placeholder: false
      })
    } else {
      // Create placeholder match
      matches.push({
        tournament_id: tournamentId,
        couple1_id: null,
        couple2_id: null,
        round: firstRound,
        order: i,
        status: 'WAITING_OPONENT' as MatchStatus,
        winner_id: null,
        type: 'ELIMINATION', 
        court: null,
        is_from_initial_generation: true,
        is_placeholder: true,
        placeholder_info: generatePlaceholderInfo(firstRound, i, structure)
      })
    }
  }

  return matches
}

/**
 * Generates subsequent rounds (all placeholders initially)
 */
function generateSubsequentRoundsWithPlaceholders(
  structure: BracketStructure,
  tournamentId: string
): DatabaseMatch[] {
  const matches: DatabaseMatch[] = []
  
  // Skip first round (already generated)
  const subsequentRounds = structure.rounds.slice(1)
  
  subsequentRounds.forEach(round => {
    const matchesInRound = structure.matchesPerRound[round]
    
    for (let i = 1; i <= matchesInRound; i++) {
      matches.push({
        tournament_id: tournamentId,
        couple1_id: null,
        couple2_id: null,
        round,
        order: i,
        status: 'WAITING_OPONENT' as MatchStatus,
        winner_id: null,
        type: 'ELIMINATION',
        court: null,
        is_from_initial_generation: true,
        is_placeholder: true,
        placeholder_info: generatePlaceholderInfo(round, i, structure)
      })
    }
  })

  return matches
}

/**
 * Generates descriptive placeholder information
 */
function generatePlaceholderInfo(round: RoundType, order: number, structure: BracketStructure): string {
  const roundOrder = ["32VOS", "16VOS", "8VOS", "4TOS", "SEMIFINAL", "FINAL"]
  const currentRoundIndex = roundOrder.indexOf(round)
  
  if (currentRoundIndex === 0) {
    // First round: show seed placeholders
    const seed1 = (order - 1) * 2 + 1
    const seed2 = (order - 1) * 2 + 2
    return `Seed ${seed1} vs Seed ${seed2}`
  } else {
    // Later rounds: show parent match references
    const parentMatch1 = (order - 1) * 2 + 1
    const parentMatch2 = (order - 1) * 2 + 2
    return `Ganador M${parentMatch1} vs Ganador M${parentMatch2}`
  }
}

/**
 * Applies the dynamic bracket to database, preserving played matches
 */
async function applyDynamicBracketToDatabase(
  newMatches: DatabaseMatch[],
  existingResults: any[],
  tournamentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    // Step 1: Delete only non-played elimination matches
    if (existingResults.length > 0) {
      // Get IDs of matches to preserve
      const preserveIds = existingResults.map(m => m.id)
      
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('type', 'ELIMINATION')
        .not('id', 'in', `(${preserveIds.join(',')})`)

      if (deleteError) {
        console.error(`🎾 [DynamicBracket] Delete error:`, deleteError)
        return { success: false, error: `Error deleting old matches: ${deleteError.message}` }
      }
    } else {
      // No matches to preserve, delete all elimination matches
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('type', 'ELIMINATION')

      if (deleteError) {
        console.error(`🎾 [DynamicBracket] Delete error:`, deleteError)
        return { success: false, error: `Error deleting matches: ${deleteError.message}` }
      }
    }

    // Step 2: Insert new matches
    const { error: insertError } = await supabase
      .from('matches')
      .insert(newMatches.map(m => ({
        ...m,
        // Remove our custom fields for database
        is_placeholder: undefined,
        placeholder_info: undefined
      })))

    if (insertError) {
      console.error(`🎾 [DynamicBracket] Insert error:`, insertError)
      return { success: false, error: `Error inserting new matches: ${insertError.message}` }
    }

    // Step 3: Update tournament status
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ 
        bracket_status: 'BRACKET_GENERATED',
        registration_locked: true,
        bracket_generated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.warn(`🎾 [DynamicBracket] Tournament update warning:`, updateError)
      // Don't fail the whole operation for this
    }

    return { success: true }

  } catch (error) {
    console.error(`🎾 [DynamicBracket] Database error:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Database operation failed" 
    }
  }
}

/**
 * Helper function to get round name from bracket size
 */
function getRoundName(bracketSize: number): RoundType {
  const roundMap: { [size: number]: RoundType } = {
    2: "FINAL",
    4: "SEMIFINAL", 
    8: "4TOS",
    16: "8VOS",
    32: "16VOS",
    64: "32VOS"
  }

  return roundMap[bracketSize] || "32VOS"
}

/**
 * Main public API - Always allow regeneration with smart handling
 */
export async function alwaysRegenerableBracket(tournamentId: string): Promise<DynamicBracketResult> {
  return generateDynamicBracket({
    tournamentId,
    forceRegeneration: true,
    preservePlayedMatches: true
  })
}

/**
 * Public API for checking if regeneration would lose data
 */
export async function previewBracketRegeneration(tournamentId: string): Promise<{
  wouldLoseData: boolean
  playedMatchesCount: number
  affectedMatches: string[]
  recommendation: string
}> {
  const state = await analyzeTournamentState(tournamentId)
  
  return {
    wouldLoseData: state.playedMatches > 0,
    playedMatchesCount: state.playedMatches,
    affectedMatches: [], // Could be enhanced to show specific matches
    recommendation: state.playedMatches === 0 
      ? "Safe to regenerate - no matches played yet"
      : `⚠️ ${state.playedMatches} matches have been played. Results will be preserved, but bracket structure may change.`
  }
}