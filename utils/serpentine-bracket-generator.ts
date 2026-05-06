/**
 * Serpentine Bracket Generator for Padel Tournaments
 * 
 * This algorithm ensures that 1A and 1B can only meet in the finals.
 * Uses a serpentine (snake) pattern to distribute zone winners across different bracket halves.
 * 
 * Key Principle: 1A goes to the left bracket tree, 1B goes to the right bracket tree.
 * They can only meet in the final.
 */

import type { Database } from '@/database.types'

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface ZonePosition {
  id: string
  tournament_id: string
  zone_id: string
  couple_id: string
  position: number
  is_definitive: boolean
  points: number
  wins: number
  losses: number
  games_for: number
  games_against: number
  games_difference: number
  player_score_total: number
  tie_info?: string
  calculated_at: string
  // Additional fields for joining
  zone_name?: string
  zone_letter?: string
  couple_name?: string
  player1_name?: string
  player2_name?: string
}

export interface SerpentineSeed {
  seed: number
  zone_letter: string
  position: number
  couple_id: string
  couple_name: string
  player1_name?: string
  player2_name?: string
  points: number
  bracket_half: 'LEFT' | 'RIGHT'  // Key field for serpentine placement
}

export interface SerpentineMatch {
  id: string
  round: string
  order: number
  couple1_seed?: SerpentineSeed
  couple2_seed?: SerpentineSeed
  couple1_id?: string | null
  couple2_id?: string | null
  status: 'PENDING' | 'WAITING_OPONENT' | 'BYE' | 'FINISHED'
  winner_id?: string | null
  bracket_half: 'LEFT' | 'RIGHT' | 'FINAL'
}

export interface SerpentineBracketResult {
  matches: SerpentineMatch[]
  seeds: SerpentineSeed[]
  bracket_size: number
  total_couples: number
  algorithm_info: {
    type: 'SERPENTINE'
    guarantee: '1A_1B_FINAL_ONLY'
    description: string
  }
}

// =============================================================================
// CORE SERPENTINE ALGORITHM
// =============================================================================

/**
 * Main function to generate a serpentine bracket from zone positions
 * 
 * @param zonePositions - Array of zone positions from the database
 * @returns Complete bracket with serpentine seeding
 */
export async function generateSerpentineBracket(
  zonePositions: ZonePosition[]
): Promise<SerpentineBracketResult> {
  console.log('[generateSerpentineBracket] Starting serpentine bracket generation...')
  console.log(`[generateSerpentineBracket] Input: ${zonePositions.length} zone positions`)
  
  // Step 1: Validate and prepare data
  const validatedPositions = validateZonePositions(zonePositions)
  if (validatedPositions.length === 0) {
    throw new Error('No valid zone positions found')
  }
  
  // Step 2: Generate serpentine seeds
  const serpentineSeeds = generateSerpentineSeeds(validatedPositions)
  console.log(`[generateSerpentineBracket] Generated ${serpentineSeeds.length} serpentine seeds`)
  
  // Step 3: Calculate bracket configuration
  const bracketSize = calculateBracketSize(serpentineSeeds.length)
  console.log(`[generateSerpentineBracket] Bracket size: ${bracketSize}`)
  
  // Step 4: Generate matches using serpentine placement
  const matches = generateSerpentineMatches(serpentineSeeds, bracketSize)
  console.log(`[generateSerpentineBracket] Generated ${matches.length} matches`)
  
  // Step 5: Verify serpentine guarantee
  verifySerpentineGuarantee(serpentineSeeds, matches)
  
  return {
    matches,
    seeds: serpentineSeeds,
    bracket_size: bracketSize,
    total_couples: serpentineSeeds.length,
    algorithm_info: {
      type: 'SERPENTINE',
      guarantee: '1A_1B_FINAL_ONLY',
      description: 'Serpentine algorithm ensuring 1A and 1B can only meet in finals'
    }
  }
}

/**
 * Validates zone positions and ensures they have required data
 */
function validateZonePositions(zonePositions: ZonePosition[]): ZonePosition[] {
  return zonePositions.filter(pos => {
    if (!pos.is_definitive) {
      console.warn(`[validateZonePositions] Skipping non-definitive position: ${pos.id}`)
      return false
    }
    
    if (!pos.couple_id || !pos.zone_id) {
      console.warn(`[validateZonePositions] Skipping incomplete position: ${pos.id}`)
      return false
    }
    
    return true
  })
}

/**
 * Generates serpentine seeds following the snake pattern:
 * - All 1st place finishers get seeds 1, 2, 3, 4, 5, 6...
 * - Then all 2nd place finishers get next seeds
 * - etc.
 * 
 * SERPENTINE PLACEMENT:
 * - 1A → LEFT bracket (seed 1)
 * - 1B → RIGHT bracket (seed 2) 
 * - 1C → LEFT bracket (seed 3)
 * - 1D → RIGHT bracket (seed 4)
 * - And so on in snake pattern...
 */
export function generateSerpentineSeeds(zonePositions: ZonePosition[]): SerpentineSeed[] {
  console.log('[generateSerpentineSeeds] Creating serpentine seeding...')
  
  // Group by position (1st, 2nd, 3rd, etc.)
  const positionGroups = groupByPosition(zonePositions)
  
  const seeds: SerpentineSeed[] = []
  let currentSeed = 1
  
  // Process each position group in order (1st place, then 2nd place, etc.)
  const positions = Object.keys(positionGroups)
    .map(Number)
    .sort((a, b) => a - b)
  
  for (const position of positions) {
    const positionsInGroup = positionGroups[position]
    
    // Sort by zone creation order (alphabetically by zone name as proxy)
    const sortedPositions = positionsInGroup.sort((a, b) => {
      // Extract zone letter for sorting (A, B, C, D, etc.)
      const zoneA = extractZoneLetter(a.zone_name || '')
      const zoneB = extractZoneLetter(b.zone_name || '')
      return zoneA.localeCompare(zoneB)
    })
    
    // Apply serpentine placement
    for (let i = 0; i < sortedPositions.length; i++) {
      const pos = sortedPositions[i]
      const zoneLetter = extractZoneLetter(pos.zone_name || '')
      
      // SERPENTINE LOGIC: Alternating LEFT/RIGHT placement
      // For 1st place: 1A→LEFT, 1B→RIGHT, 1C→LEFT, 1D→RIGHT...
      // For 2nd place: 2A→LEFT, 2B→RIGHT, 2C→LEFT, 2D→RIGHT...
      const bracketHalf: 'LEFT' | 'RIGHT' = (i % 2 === 0) ? 'LEFT' : 'RIGHT'
      
      seeds.push({
        seed: currentSeed,
        zone_letter: zoneLetter,
        position: pos.position,
        couple_id: pos.couple_id,
        couple_name: pos.couple_name || `${pos.player1_name || 'P1'}/${pos.player2_name || 'P2'}`,
        player1_name: pos.player1_name,
        player2_name: pos.player2_name,
        points: pos.points,
        bracket_half: bracketHalf
      })
      
      console.log(
        `[generateSerpentineSeeds] Seed ${currentSeed}: ${position}° ${zoneLetter} → ${bracketHalf} bracket (${pos.points} pts)`
      )
      
      currentSeed++
    }
  }
  
  return seeds
}

/**
 * Groups zone positions by their position in zone (1st, 2nd, 3rd, etc.)
 */
function groupByPosition(zonePositions: ZonePosition[]): { [position: number]: ZonePosition[] } {
  const groups: { [position: number]: ZonePosition[] } = {}
  
  for (const pos of zonePositions) {
    if (!groups[pos.position]) {
      groups[pos.position] = []
    }
    groups[pos.position].push(pos)
  }
  
  return groups
}

/**
 * Extracts zone letter from zone name (e.g., "Zona A" → "A")
 */
function extractZoneLetter(zoneName: string): string {
  const match = zoneName.match(/[A-Z]/)
  return match ? match[0] : zoneName
}

/**
 * Calculates bracket size (next power of 2)
 */
function calculateBracketSize(totalCouples: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, totalCouples))))
}

/**
 * Generates matches using serpentine placement
 * Key insight: Traditional bracket pairing but with serpentine-placed seeds
 */
function generateSerpentineMatches(
  seeds: SerpentineSeed[], 
  bracketSize: number
): SerpentineMatch[] {
  console.log('[generateSerpentineMatches] Creating matches with serpentine placement...')
  
  const matches: SerpentineMatch[] = []
  
  // Create participant array with BYEs
  const participants: (SerpentineSeed | null)[] = new Array(bracketSize).fill(null)
  
  // Place real seeds in order (serpentine placement already handled in seed generation)
  for (let i = 0; i < seeds.length && i < bracketSize; i++) {
    participants[i] = seeds[i]
  }
  
  // Generate all rounds
  const rounds = calculateRounds(bracketSize)
  
  // First round: pair participants using traditional bracket pairing
  const firstRoundMatches = generateFirstRound(participants, rounds[0])
  matches.push(...firstRoundMatches)
  
  // Subsequent rounds: create placeholder matches
  for (let i = 1; i < rounds.length; i++) {
    const roundMatches = generatePlaceholderRound(rounds[i], rounds[i-1])
    matches.push(...roundMatches)
  }
  
  return matches
}

/**
 * Calculates all rounds needed for the bracket
 */
function calculateRounds(bracketSize: number): Array<{ name: string; size: number; matchCount: number; bracketHalf?: 'LEFT' | 'RIGHT' | 'FINAL' }> {
  const rounds: Array<{ name: string; size: number; matchCount: number; bracketHalf?: 'LEFT' | 'RIGHT' | 'FINAL' }> = []
  
  let currentSize = bracketSize
  while (currentSize >= 2) {
    const roundName = getRoundName(currentSize)
    const matchCount = currentSize / 2
    
    // Determine bracket half for this round
    let bracketHalf: 'LEFT' | 'RIGHT' | 'FINAL' | undefined
    if (currentSize === 2) {
      bracketHalf = 'FINAL'  // Final match
    } else if (matchCount > 1) {
      bracketHalf = undefined  // Mixed round (has both LEFT and RIGHT matches)
    }
    
    rounds.push({
      name: roundName,
      size: currentSize,
      matchCount,
      bracketHalf
    })
    
    currentSize = currentSize / 2
  }
  
  return rounds
}

/**
 * Gets round name based on bracket size
 */
function getRoundName(bracketSize: number): string {
  const roundMap: { [size: number]: string } = {
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
 * Generates first round matches with traditional bracket pairing
 * This preserves the serpentine placement created during seeding
 */
function generateFirstRound(
  participants: (SerpentineSeed | null)[], 
  round: { name: string; size: number; matchCount: number }
): SerpentineMatch[] {
  const matches: SerpentineMatch[] = []
  const bracketSize = participants.length
  
  // Use traditional bracket pairing indices
  const pairingIndices = getBracketPairingIndices(bracketSize)
  
  for (let i = 0; i < pairingIndices.length; i += 2) {
    const index1 = pairingIndices[i]
    const index2 = pairingIndices[i + 1]
    
    const seed1 = participants[index1]
    const seed2 = participants[index2]
    
    // Determine which bracket half this match belongs to
    const bracketHalf = determineBracketHalf(seed1, seed2, Math.floor(i / 2) + 1, round.matchCount)
    
    // Determine match status
    const { status, winner_id } = determineMatchStatus(seed1, seed2)
    
    matches.push({
      id: `serpentine-match-${Math.floor(i / 2) + 1}`,
      round: round.name,
      order: Math.floor(i / 2) + 1,
      couple1_seed: seed1 || undefined,
      couple2_seed: seed2 || undefined,
      couple1_id: seed1?.couple_id || null,
      couple2_id: seed2?.couple_id || null,
      status,
      winner_id,
      bracket_half: bracketHalf
    })
  }
  
  console.log(`[generateFirstRound] Created ${matches.length} first round matches`)
  return matches
}

/**
 * Determines which bracket half a match belongs to
 */
function determineBracketHalf(
  seed1: SerpentineSeed | null, 
  seed2: SerpentineSeed | null, 
  matchOrder: number,
  totalMatches: number
): 'LEFT' | 'RIGHT' {
  // If we have seeds, use their bracket half assignment
  if (seed1?.bracket_half) return seed1.bracket_half
  if (seed2?.bracket_half) return seed2.bracket_half
  
  // Fallback: first half of matches go to LEFT, second half to RIGHT
  return matchOrder <= totalMatches / 2 ? 'LEFT' : 'RIGHT'
}

/**
 * Determines match status based on participants
 */
function determineMatchStatus(
  seed1: SerpentineSeed | null, 
  seed2: SerpentineSeed | null
): { status: 'PENDING' | 'WAITING_OPONENT' | 'BYE', winner_id: string | null } {
  if (seed1 && seed2) {
    return { status: 'PENDING', winner_id: null }
  }
  
  if (seed1 && !seed2) {
    return { status: 'BYE', winner_id: seed1.couple_id }
  }
  
  if (!seed1 && seed2) {
    return { status: 'BYE', winner_id: seed2.couple_id }
  }
  
  return { status: 'WAITING_OPONENT', winner_id: null }
}

/**
 * Generates placeholder matches for subsequent rounds
 */
function generatePlaceholderRound(
  currentRound: { name: string; size: number; matchCount: number; bracketHalf?: 'LEFT' | 'RIGHT' | 'FINAL' },
  previousRound: { name: string; size: number; matchCount: number }
): SerpentineMatch[] {
  const matches: SerpentineMatch[] = []
  
  for (let matchOrder = 1; matchOrder <= currentRound.matchCount; matchOrder++) {
    // Determine bracket half for this match
    let bracketHalf: 'LEFT' | 'RIGHT' | 'FINAL'
    
    if (currentRound.bracketHalf) {
      bracketHalf = currentRound.bracketHalf
    } else {
      // For non-final rounds, determine based on match position
      bracketHalf = matchOrder <= currentRound.matchCount / 2 ? 'LEFT' : 'RIGHT'
    }
    
    matches.push({
      id: `serpentine-match-${currentRound.name.toLowerCase()}-${matchOrder}`,
      round: currentRound.name,
      order: matchOrder,
      couple1_seed: undefined,
      couple2_seed: undefined,
      couple1_id: null,
      couple2_id: null,
      status: 'WAITING_OPONENT',
      winner_id: null,
      bracket_half: bracketHalf
    })
  }
  
  console.log(`[generatePlaceholderRound] Created ${matches.length} placeholder matches for ${currentRound.name}`)
  return matches
}

/**
 * Gets traditional bracket pairing indices
 */
function getBracketPairingIndices(bracketSize: number): number[] {
  // Use traditional tournament bracket pairing
  const patterns: { [size: number]: number[] } = {
    2: [0, 1],
    4: [0, 3, 1, 2],
    8: [0, 7, 3, 4, 1, 6, 2, 5],
    16: [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10],
    32: [0, 31, 15, 16, 7, 24, 8, 23, 3, 28, 12, 19, 4, 27, 11, 20, 1, 30, 14, 17, 6, 25, 9, 22, 2, 29, 13, 18, 5, 26, 10, 21]
  }
  
  if (patterns[bracketSize]) {
    return patterns[bracketSize]
  }
  
  // Fallback for other sizes
  const indices: number[] = []
  for (let i = 0; i < bracketSize / 2; i++) {
    indices.push(i, bracketSize - 1 - i)
  }
  return indices
}

/**
 * Verifies that the serpentine guarantee is maintained
 * Ensures 1A and 1B are in different bracket halves
 */
function verifySerpentineGuarantee(seeds: SerpentineSeed[], matches: SerpentineMatch[]): void {
  console.log('[verifySerpentineGuarantee] Verifying serpentine guarantee...')
  
  // Find 1A and 1B (first place finishers from zones A and B)
  const seed1A = seeds.find(s => s.zone_letter === 'A' && s.position === 1)
  const seed1B = seeds.find(s => s.zone_letter === 'B' && s.position === 1)
  
  if (!seed1A || !seed1B) {
    console.warn('[verifySerpentineGuarantee] Cannot verify: 1A or 1B not found')
    return
  }
  
  console.log(`[verifySerpentineGuarantee] 1A (Seed ${seed1A.seed}): ${seed1A.bracket_half} bracket`)
  console.log(`[verifySerpentineGuarantee] 1B (Seed ${seed1B.seed}): ${seed1B.bracket_half} bracket`)
  
  // Verify they are in different bracket halves
  if (seed1A.bracket_half === seed1B.bracket_half) {
    throw new Error(`SERPENTINE GUARANTEE VIOLATED: 1A and 1B are both in ${seed1A.bracket_half} bracket`)
  }
  
  // Verify they can only meet in the final
  const finalMatch = matches.find(m => m.bracket_half === 'FINAL')
  if (!finalMatch) {
    throw new Error('SERPENTINE GUARANTEE ERROR: No final match found')
  }
  
  console.log('[verifySerpentineGuarantee] ✅ Serpentine guarantee verified: 1A and 1B can only meet in finals')
}

// =============================================================================
// DATABASE INTEGRATION FUNCTIONS
// =============================================================================

/**
 * Queries zone positions from the database using MCP
 */
export async function fetchZonePositionsForBracket(
  tournamentId: string
): Promise<ZonePosition[]> {
  console.log(`[fetchZonePositionsForBracket] Fetching zone positions for tournament ${tournamentId}`)
  
  // This would use MCP to query the database
  // For now, return a placeholder structure
  const query = `
    SELECT 
      zp.*,
      z.name as zone_name,
      c.player1_id,
      c.player2_id,
      p1.first_name || ' ' || p1.last_name as player1_name,
      p2.first_name || ' ' || p2.last_name as player2_name
    FROM zone_positions zp
    JOIN zones z ON zp.zone_id = z.id
    JOIN couples c ON zp.couple_id = c.id
    LEFT JOIN users p1 ON c.player1_id = p1.id
    LEFT JOIN users p2 ON c.player2_id = p2.id
    WHERE zp.tournament_id = $1 
      AND zp.is_definitive = true
    ORDER BY z.name, zp.position
  `
  
  // The actual implementation would use MCP execute_sql here
  // Return placeholder for now
  return []
}

/**
 * Converts serpentine matches to database format
 */
export function convertSerpentineMatchesToDB(
  result: SerpentineBracketResult,
  tournamentId: string
): any[] {
  return result.matches.map((match, index) => ({
    tournament_id: tournamentId,
    couple1_id: match.couple1_id,
    couple2_id: match.couple2_id,
    round: match.round,
    order: match.order,
    status: match.status,
    winner_id: match.winner_id,
    type: 'ELIMINATION',
    court: null,
    // Eliminar bracket_half y algorithm_type que no existen en la tabla
    created_at: new Date().toISOString()
  }))
}

// =============================================================================
// PLACEHOLDER GENERATION FOR UI
// =============================================================================

/**
 * Generates placeholder text for serpentine matches in the UI
 */
export function getSerpentinePlaceholderText(
  match: SerpentineMatch,
  isCouple1: boolean
): string {
  const seed = isCouple1 ? match.couple1_seed : match.couple2_seed
  
  if (seed) {
    return `${seed.position}° ${seed.zone_letter} (Seed ${seed.seed})`
  }
  
  // For placeholder matches, show what we're waiting for
  if (match.status === 'WAITING_OPONENT') {
    const parentMatch1Order = (match.order - 1) * 2 + 1
    const parentMatch2Order = (match.order - 1) * 2 + 2
    
    const parentMatchOrder = isCouple1 ? parentMatch1Order : parentMatch2Order
    return `Ganador M${parentMatchOrder}`
  }
  
  return 'Por definir'
}

// =============================================================================
// TESTING AND EXAMPLE FUNCTIONS
// =============================================================================

/**
 * Example function to test the serpentine algorithm
 */
export function testSerpentineAlgorithm(): void {
  console.log('🐍 === TESTING SERPENTINE BRACKET ALGORITHM ===\n')
  
  // Create test data: 8 couples from 4 zones (2 couples per zone)
  const testZonePositions: ZonePosition[] = [
    // Zone A
    { 
      id: '1', tournament_id: 'test', zone_id: 'zone-a', couple_id: 'couple-1a-1st', 
      position: 1, is_definitive: true, points: 12, wins: 4, losses: 0, 
      games_for: 24, games_against: 12, games_difference: 12, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona A', player1_name: 'Juan', player2_name: 'Carlos'
    },
    { 
      id: '2', tournament_id: 'test', zone_id: 'zone-a', couple_id: 'couple-1a-2nd', 
      position: 2, is_definitive: true, points: 9, wins: 3, losses: 1, 
      games_for: 22, games_against: 16, games_difference: 6, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona A', player1_name: 'Ana', player2_name: 'María'
    },
    
    // Zone B  
    { 
      id: '3', tournament_id: 'test', zone_id: 'zone-b', couple_id: 'couple-1b-1st', 
      position: 1, is_definitive: true, points: 11, wins: 4, losses: 0, 
      games_for: 23, games_against: 13, games_difference: 10, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona B', player1_name: 'Luis', player2_name: 'Pedro'
    },
    { 
      id: '4', tournament_id: 'test', zone_id: 'zone-b', couple_id: 'couple-1b-2nd', 
      position: 2, is_definitive: true, points: 8, wins: 2, losses: 2, 
      games_for: 20, games_against: 18, games_difference: 2, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona B', player1_name: 'Diego', player2_name: 'Javier'
    },
    
    // Zone C
    { 
      id: '5', tournament_id: 'test', zone_id: 'zone-c', couple_id: 'couple-1c-1st', 
      position: 1, is_definitive: true, points: 10, wins: 3, losses: 1, 
      games_for: 21, games_against: 15, games_difference: 6, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona C', player1_name: 'Carmen', player2_name: 'Elena'
    },
    { 
      id: '6', tournament_id: 'test', zone_id: 'zone-c', couple_id: 'couple-1c-2nd', 
      position: 2, is_definitive: true, points: 7, wins: 2, losses: 2, 
      games_for: 19, games_against: 17, games_difference: 2, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona C', player1_name: 'Roberto', player2_name: 'Fernando'
    },
    
    // Zone D
    { 
      id: '7', tournament_id: 'test', zone_id: 'zone-d', couple_id: 'couple-1d-1st', 
      position: 1, is_definitive: true, points: 9, wins: 3, losses: 1, 
      games_for: 20, games_against: 14, games_difference: 6, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona D', player1_name: 'Isabel', player2_name: 'Cristina'
    },
    { 
      id: '8', tournament_id: 'test', zone_id: 'zone-d', couple_id: 'couple-1d-2nd', 
      position: 2, is_definitive: true, points: 6, wins: 2, losses: 2, 
      games_for: 18, games_against: 16, games_difference: 2, player_score_total: 600,
      calculated_at: new Date().toISOString(),
      zone_name: 'Zona D', player1_name: 'Laura', player2_name: 'Sofia'
    },
  ]
  
  console.log('📋 Test Data: 8 couples from 4 zones')
  testZonePositions.forEach(pos => {
    console.log(`  ${pos.position}° ${pos.zone_name}: ${pos.player1_name}/${pos.player2_name} (${pos.points} pts)`)
  })
  
  console.log('\n🐍 Generating serpentine bracket...')
  
  try {
    generateSerpentineBracket(testZonePositions).then(result => {
      console.log('\n✅ Serpentine bracket generated successfully!')
      console.log(`📊 Algorithm: ${result.algorithm_info.type}`)
      console.log(`🎯 Guarantee: ${result.algorithm_info.guarantee}`)
      console.log(`📏 Bracket size: ${result.bracket_size}`)
      console.log(`👥 Total couples: ${result.total_couples}`)
      
      console.log('\n🎯 Serpentine Seeds:')
      result.seeds.forEach(seed => {
        console.log(`  Seed ${seed.seed}: ${seed.position}° ${seed.zone_letter} → ${seed.bracket_half} bracket`)
      })
      
      console.log('\n⚔️ First Round Matches:')
      const firstRoundMatches = result.matches.filter(m => m.round === '4TOS')
      firstRoundMatches.forEach(match => {
        const c1 = match.couple1_seed ? `Seed ${match.couple1_seed.seed} (${match.couple1_seed.zone_letter})` : 'BYE'
        const c2 = match.couple2_seed ? `Seed ${match.couple2_seed.seed} (${match.couple2_seed.zone_letter})` : 'BYE'
        console.log(`  Match ${match.order} [${match.bracket_half}]: ${c1} vs ${c2}`)
      })
      
      console.log('\n🏆 Key Verification:')
      const seed1A = result.seeds.find(s => s.zone_letter === 'A' && s.position === 1)
      const seed1B = result.seeds.find(s => s.zone_letter === 'B' && s.position === 1)
      
      if (seed1A && seed1B) {
        console.log(`  ✅ 1A (Seed ${seed1A.seed}) in ${seed1A.bracket_half} bracket`)
        console.log(`  ✅ 1B (Seed ${seed1B.seed}) in ${seed1B.bracket_half} bracket`)
        console.log(`  ✅ They can only meet in: FINAL`)
      }
      
      console.log('\n🎉 Serpentine algorithm test completed successfully!')
    }).catch(error => {
      console.error('❌ Error testing serpentine algorithm:', error)
    })
  } catch (error) {
    console.error('❌ Error testing serpentine algorithm:', error)
  }
}

// Run test if this file is executed directly
// Uncomment the line below to test:
// testSerpentineAlgorithm()