/**
 * FLEXIBLE BRACKET GENERATOR
 * 
 * Integrates the alternating-bracket-algorithm.ts with the main system
 * and provides flexible regeneration capabilities with impact analysis.
 */

import { createClient } from "@/utils/supabase/server"
import type { Database } from '@/database.types'
import { 
  generateAlternatingBracketSeeding,
  type CoupleFromZone,
  type SeededCouple,
  type BracketPairing,
  verifyZoneSeparation 
} from "../test-bracket-seeding/alternating-bracket-algorithm"
import { 
  analyzeBracketState, 
  validateBracketAction,
  type BracketState 
} from "./bracket-state-manager"

// Types for database interaction
type MatchStatus = Database["public"]["Enums"]["match_status"]
type RoundType = Database["public"]["Enums"]["ROUND"]

export interface FlexibleBracketConfig {
  tournamentId: string
  preservePlayedMatches?: boolean
  dryRun?: boolean // For impact analysis without actually creating
}

export interface BracketGenerationResult {
  success: boolean
  matches?: DatabaseMatch[]
  seededCouples?: SeededCouple[]
  bracketSize?: number
  impactAnalysis: {
    totalMatches: number
    newMatches: number
    preservedMatches: number
    deletedMatches: number
    warnings: string[]
  }
  zoneSeparationVerification?: {
    isValid: boolean
    issues: string[]
    maxSeparation: number
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
}

/**
 * Main function to generate or regenerate tournament bracket with flexibility
 */
export async function generateFlexibleBracket(
  config: FlexibleBracketConfig
): Promise<BracketGenerationResult> {
  const { tournamentId, preservePlayedMatches = false, dryRun = false } = config
  
  console.log(`🎾 [FlexibleBracket] Starting generation for tournament ${tournamentId}`)
  console.log(`🎾 [FlexibleBracket] Config: preserve=${preservePlayedMatches}, dryRun=${dryRun}`)

  try {
    // Step 1: Validate current state
    const validation = await validateBracketAction(tournamentId, 'REGENERATE_BRACKET')
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.warning || "Regeneration not allowed in current state",
        impactAnalysis: {
          totalMatches: 0,
          newMatches: 0,
          preservedMatches: 0,
          deletedMatches: 0,
          warnings: [validation.warning || "Action not allowed"]
        }
      }
    }

    // Step 2: Get zone results and build couples data
    const couplesFromZones = await getCouplesFromZoneResults(tournamentId)
    if (couplesFromZones.length === 0) {
      return {
        success: false,
        error: "No couples found in tournament zones",
        impactAnalysis: {
          totalMatches: 0,
          newMatches: 0,
          preservedMatches: 0,
          deletedMatches: 0,
          warnings: ["No couples available for bracket generation"]
        }
      }
    }

    // Step 3: Generate bracket using your alternating algorithm
    const bracketResult = generateAlternatingBracketSeeding(couplesFromZones)
    console.log(`🎾 [FlexibleBracket] Generated bracket: ${bracketResult.bracketPairings.length} pairings`)

    // Step 4: Analyze impact on existing matches
    const impactAnalysis = await analyzeBracketImpact(
      tournamentId, 
      bracketResult.bracketPairings,
      preservePlayedMatches
    )

    // Step 5: Verify zone separation quality
    const zoneSeparationVerification = verifyZoneSeparation(
      bracketResult.seededCouples, 
      bracketResult.bracketPairings
    )

    // Step 6: Convert to database format
    const databaseMatches = convertBracketToDatabase(
      bracketResult.bracketPairings,
      tournamentId
    )

    // If dry run, return analysis without making changes
    if (dryRun) {
      return {
        success: true,
        matches: databaseMatches,
        seededCouples: bracketResult.seededCouples,
        bracketSize: bracketResult.bracketSize,
        impactAnalysis,
        zoneSeparationVerification
      }
    }

    // Step 7: Apply changes to database
    const dbResult = await applyBracketToDatabase(
      databaseMatches,
      impactAnalysis,
      preservePlayedMatches
    )

    if (!dbResult.success) {
      return {
        success: false,
        error: dbResult.error,
        impactAnalysis
      }
    }

    console.log(`🎾 [FlexibleBracket] ✅ Successfully generated flexible bracket`)
    return {
      success: true,
      matches: databaseMatches,
      seededCouples: bracketResult.seededCouples,
      bracketSize: bracketResult.bracketSize,
      impactAnalysis,
      zoneSeparationVerification
    }

  } catch (error) {
    console.error(`🎾 [FlexibleBracket] ❌ Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      impactAnalysis: {
        totalMatches: 0,
        newMatches: 0,
        preservedMatches: 0,
        deletedMatches: 0,
        warnings: ["Error during generation"]
      }
    }
  }
}

/**
 * Gets couples from zone results to feed into the alternating algorithm
 */
async function getCouplesFromZoneResults(tournamentId: string): Promise<CoupleFromZone[]> {
  const supabase = await createClient()

  // Get zone results with proper ranking
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

  if (!zonePositions) {
    console.warn(`🎾 [FlexibleBracket] No zone positions found for tournament ${tournamentId}`)
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

  console.log(`🎾 [FlexibleBracket] Found ${couplesFromZones.length} couples from zones`)
  return couplesFromZones
}

/**
 * Analyzes the impact of regenerating the bracket
 */
async function analyzeBracketImpact(
  tournamentId: string,
  newBracketPairings: BracketPairing[],
  preservePlayedMatches: boolean
): Promise<BracketGenerationResult['impactAnalysis']> {
  const supabase = await createClient()

  // Get existing elimination matches
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id, status, couple1_id, couple2_id, winner_id, round, order')
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')

  const existingCount = existingMatches?.length || 0
  const newCount = newBracketPairings.length
  
  const playedMatches = existingMatches?.filter(m => 
    m.status === 'FINISHED' || m.status === 'IN_PROGRESS'
  ) || []

  const warnings: string[] = []
  let preservedMatches = 0
  let deletedMatches = existingCount

  if (preservePlayedMatches && playedMatches.length > 0) {
    preservedMatches = playedMatches.length
    deletedMatches = existingCount - preservedMatches
    warnings.push(`Se intentará preservar ${preservedMatches} matches jugados`)
  }

  if (playedMatches.length > 0 && !preservePlayedMatches) {
    warnings.push(`⚠️ ${playedMatches.length} matches jugados serán eliminados`)
  }

  if (newCount !== existingCount) {
    warnings.push(`Estructura del bracket cambió: ${existingCount} → ${newCount} matches`)
  }

  return {
    totalMatches: newCount,
    newMatches: Math.max(0, newCount - preservedMatches),
    preservedMatches,
    deletedMatches,
    warnings
  }
}

/**
 * Converts bracket pairings to database format
 */
function convertBracketToDatabase(
  bracketPairings: BracketPairing[],
  tournamentId: string
): DatabaseMatch[] {
  return bracketPairings.map(pairing => ({
    tournament_id: tournamentId,
    couple1_id: pairing.couple1.id,
    couple2_id: pairing.couple2?.id || null,
    round: pairing.round as RoundType,
    order: pairing.order,
    status: (pairing.couple2 === null ? 'BYE' : 'PENDING') as MatchStatus,
    winner_id: pairing.couple2 === null ? pairing.couple1.id : null,
    type: 'ELIMINATION' as const,
    court: null,
    is_from_initial_generation: true
  }))
}

/**
 * Applies the new bracket to the database
 */
async function applyBracketToDatabase(
  newMatches: DatabaseMatch[],
  impactAnalysis: BracketGenerationResult['impactAnalysis'],
  preservePlayedMatches: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const tournamentId = newMatches[0]?.tournament_id

  if (!tournamentId) {
    return { success: false, error: "No tournament ID found in matches" }
  }

  try {
    // Start transaction-like approach
    // Step 1: Delete existing elimination matches (unless preserving)
    if (!preservePlayedMatches || impactAnalysis.deletedMatches > 0) {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('type', 'ELIMINATION')

      if (deleteError) {
        console.error(`🎾 [FlexibleBracket] Delete error:`, deleteError)
        return { success: false, error: `Error deleting existing matches: ${deleteError.message}` }
      }
    }

    // Step 2: Insert new matches
    const { error: insertError } = await supabase
      .from('matches')
      .insert(newMatches)

    if (insertError) {
      console.error(`🎾 [FlexibleBracket] Insert error:`, insertError)
      return { success: false, error: `Error inserting new matches: ${insertError.message}` }
    }

    // Step 3: Update tournament bracket status with timestamp
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ 
        bracket_status: 'BRACKET_GENERATED',
        registration_locked: true,
        bracket_generated_at: new Date().toISOString()
      })
      .eq('id', tournamentId)

    if (updateError) {
      console.warn(`🎾 [FlexibleBracket] Tournament update warning:`, updateError)
      // Don't fail the whole operation for this
    }

    return { success: true }

  } catch (error) {
    console.error(`🎾 [FlexibleBracket] Database error:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Database operation failed" 
    }
  }
}

/**
 * Provides a preview of bracket regeneration impact without making changes
 */
export async function previewBracketRegeneration(
  tournamentId: string
): Promise<BracketGenerationResult> {
  return generateFlexibleBracket({
    tournamentId,
    dryRun: true
  })
}

/**
 * Smart regeneration that tries to preserve played matches when possible
 */
export async function smartBracketRegeneration(
  tournamentId: string
): Promise<BracketGenerationResult> {
  const stateInfo = await analyzeBracketState(tournamentId)
  
  return generateFlexibleBracket({
    tournamentId,
    preservePlayedMatches: stateInfo.playedMatchesCount > 0
  })
}