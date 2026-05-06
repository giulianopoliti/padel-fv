/**
 * ALTERNATING BRACKET SEEDING ALGORITHM
 * 
 * This algorithm implements a zone-based alternating seeding system where:
 * - Zone A 1st place → Top of bracket (Seed 1)
 * - Zone B 1st place → Bottom of bracket (Seed 2) 
 * - Zone C 1st place → Top of bracket (Seed 3)
 * - Zone D 1st place → Bottom of bracket (Seed 4)
 * - And so on alternating...
 * 
 * This ensures maximum separation between zone winners, so they only meet in later rounds.
 */

export interface CoupleFromZone {
  id: string
  zoneId: string
  zoneName: string // "Zone A", "Zone B", etc.
  zonePosition: number // 1, 2, 3, 4 (position within zone)
  points: number
  player1Name: string
  player2Name: string
}

export interface SeededCouple extends CoupleFromZone {
  seed: number // Global seed (1, 2, 3, ...)
  bracketPosition: 'TOP' | 'BOTTOM' // Which half of bracket
}

export interface BracketPairing {
  matchId: string
  couple1: SeededCouple
  couple2: SeededCouple | null // null for BYE
  round: string
  order: number
}

/**
 * Main function: Generate alternating bracket seeding for all couples from zones
 * 
 * Key insight: ALL couples advance from zones (no elimination in zones)
 * Seeding priority: Zone position first, then alternating bracket placement
 */
export function generateAlternatingBracketSeeding(couples: CoupleFromZone[]): {
  seededCouples: SeededCouple[]
  bracketPairings: BracketPairing[]
  bracketSize: number
  summary: string
} {
  console.log("🎾 === ALTERNATING BRACKET SEEDING ALGORITHM ===")
  console.log(`Input: ${couples.length} couples from zones`)
  
  // Step 1: Group couples by zone position
  const couplesByPosition = groupCouplesByPosition(couples)
  console.log("📊 Couples grouped by position:", Object.keys(couplesByPosition).map(pos => `${pos}: ${couplesByPosition[parseInt(pos)].length} couples`))
  
  // Step 2: Apply alternating seeding within each position group
  const seededCouples = applyAlternatingSeeding(couplesByPosition)
  console.log(`✅ Seeded ${seededCouples.length} couples`)
  
  // Step 3: Calculate bracket size (next power of 2)
  const bracketSize = calculateBracketSize(seededCouples.length)
  console.log(`📐 Bracket size: ${bracketSize} (${bracketSize - seededCouples.length} BYEs needed)`)
  
  // Step 4: Generate bracket pairings
  const bracketPairings = generateBracketPairings(seededCouples, bracketSize)
  console.log(`⚔️ Generated ${bracketPairings.length} bracket pairings`)
  
  // Step 5: Generate summary
  const summary = generateBracketSummary(seededCouples, bracketPairings, bracketSize)
  
  return {
    seededCouples,
    bracketPairings,
    bracketSize,
    summary
  }
}

/**
 * Groups couples by their position within zones (1st, 2nd, 3rd, 4th)
 */
function groupCouplesByPosition(couples: CoupleFromZone[]): Record<number, CoupleFromZone[]> {
  const grouped: Record<number, CoupleFromZone[]> = {}
  
  couples.forEach(couple => {
    if (!grouped[couple.zonePosition]) {
      grouped[couple.zonePosition] = []
    }
    grouped[couple.zonePosition].push(couple)
  })
  
  // Sort couples within each position by zone name (A, B, C, D...)
  Object.keys(grouped).forEach(position => {
    grouped[parseInt(position)].sort((a, b) => {
      // First by zone name (alphabetical)
      if (a.zoneName !== b.zoneName) {
        return a.zoneName.localeCompare(b.zoneName)
      }
      // Then by points (descending) as tiebreaker
      return b.points - a.points
    })
  })
  
  return grouped
}

/**
 * Applies alternating seeding logic:
 * - Process positions in order (1st, 2nd, 3rd, 4th)
 * - Within each position, alternate between TOP and BOTTOM bracket placement
 */
function applyAlternatingSeeding(couplesByPosition: Record<number, CoupleFromZone[]>): SeededCouple[] {
  const seededCouples: SeededCouple[] = []
  let currentSeed = 1
  
  // Process positions in order (1st place, then 2nd place, etc.)
  const positions = Object.keys(couplesByPosition).map(Number).sort((a, b) => a - b)
  
  positions.forEach(position => {
    const couplesInPosition = couplesByPosition[position]
    console.log(`\n🏆 Processing ${getPositionName(position)} place (${couplesInPosition.length} couples)`)
    
    couplesInPosition.forEach((couple, index) => {
      // Alternating bracket placement: even index = TOP, odd index = BOTTOM
      const bracketPosition: 'TOP' | 'BOTTOM' = index % 2 === 0 ? 'TOP' : 'BOTTOM'
      
      const seededCouple: SeededCouple = {
        ...couple,
        seed: currentSeed++,
        bracketPosition
      }
      
      seededCouples.push(seededCouple)
      
      console.log(`  Seed ${seededCouple.seed}: ${couple.zoneName} (${getPositionName(position)}) → ${bracketPosition} bracket`)
    })
  })
  
  return seededCouples
}

/**
 * Calculate bracket size (next power of 2)
 */
function calculateBracketSize(totalCouples: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, totalCouples))))
}

/**
 * Generate bracket pairings using alternating placement
 * Key: TOP bracket couples get seeds 1, 3, 5, 7... 
 *      BOTTOM bracket couples get seeds 2, 4, 6, 8...
 */
function generateBracketPairings(seededCouples: SeededCouple[], bracketSize: number): BracketPairing[] {
  const pairings: BracketPairing[] = []
  
  // Separate couples by bracket half
  const topBracketCouples = seededCouples.filter(c => c.bracketPosition === 'TOP').sort((a, b) => a.seed - b.seed)
  const bottomBracketCouples = seededCouples.filter(c => c.bracketPosition === 'BOTTOM').sort((a, b) => a.seed - b.seed)
  
  console.log(`\n📋 Bracket distribution:`)
  console.log(`  TOP bracket: ${topBracketCouples.length} couples (Seeds: ${topBracketCouples.map(c => c.seed).join(', ')})`)
  console.log(`  BOTTOM bracket: ${bottomBracketCouples.length} couples (Seeds: ${bottomBracketCouples.map(c => c.seed).join(', ')})`)
  
  // Create array with all participants (including BYEs)
  const allParticipants: (SeededCouple | null)[] = new Array(bracketSize).fill(null)
  
  // Place couples in bracket positions using alternating pattern
  let topIndex = 0
  let bottomIndex = 0
  
  for (let i = 0; i < bracketSize; i++) {
    if (i % 2 === 0) {
      // Even positions (0, 2, 4...) get TOP bracket couples
      if (topIndex < topBracketCouples.length) {
        allParticipants[i] = topBracketCouples[topIndex++]
      }
    } else {
      // Odd positions (1, 3, 5...) get BOTTOM bracket couples
      if (bottomIndex < bottomBracketCouples.length) {
        allParticipants[i] = bottomBracketCouples[bottomIndex++]
      }
    }
  }
  
  // Generate traditional bracket pairings (1 vs N, 2 vs N-1, etc.)
  const roundName = getRoundName(bracketSize)
  
  for (let i = 0; i < bracketSize; i += 2) {
    const posA = allParticipants[i]
    const posB = allParticipants[bracketSize - 1 - i]

    // Skip if both positions are BYE (should not happen, but guards TypeErrors)
    if (!posA && !posB) {
      continue
    }

    // Ensure couple1 is always a real participant (non-null) so downstream code is safe
    const couple1 = (posA ?? posB)! // the non-null participant
    const couple2 = posA ? posB : null // BYE if only one participant in this pairing

    pairings.push({
      matchId: `match-${pairings.length + 1}`,
      couple1,
      couple2,
      round: roundName,
      order: pairings.length + 1
    })
  }
  
  return pairings
}

/**
 * Generate bracket summary for testing/debugging purposes
 */
function generateBracketSummary(seededCouples: SeededCouple[], pairings: BracketPairing[], bracketSize: number): string {
  let summary = `\n🎯 === BRACKET SEEDING SUMMARY ===\n`
  summary += `Total couples: ${seededCouples.length}\n`
  summary += `Bracket size: ${bracketSize}\n`
  summary += `BYEs needed: ${bracketSize - seededCouples.length}\n\n`
  
  // Show seeding by position
  const positions = [...new Set(seededCouples.map(c => c.zonePosition))].sort((a, b) => a - b)
  
  positions.forEach(position => {
    const couplesInPosition = seededCouples.filter(c => c.zonePosition === position)
    summary += `${getPositionName(position)} place seeds:\n`
    
    couplesInPosition.forEach(couple => {
      summary += `  Seed ${couple.seed}: ${couple.zoneName} (${couple.bracketPosition}) - ${couple.player1Name}/${couple.player2Name}\n`
    })
    summary += `\n`
  })
  
  // Show first round pairings
  summary += `First round pairings:\n`
  pairings.forEach(pairing => {
    const p1 = `Seed ${pairing.couple1.seed} (${pairing.couple1.zoneName})`
    const p2 = pairing.couple2 ? `Seed ${pairing.couple2.seed} (${pairing.couple2.zoneName})` : 'BYE'
    summary += `  Match ${pairing.order}: ${p1} vs ${p2}\n`
  })
  
  return summary
}

/**
 * Helper functions
 */
function getPositionName(position: number): string {
  const names = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
  return names[position as keyof typeof names] || `${position}th`
}

function getRoundName(bracketSize: number): string {
  const roundMap: Record<number, string> = {
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
 * Key insight verification function
 * Checks that zone winners from different zones are properly separated
 */
export function verifyZoneSeparation(seededCouples: SeededCouple[], pairings: BracketPairing[]): {
  isValid: boolean
  issues: string[]
  maxSeparation: number
} {
  const issues: string[] = []
  
  // Get all zone winners (1st place)
  const zoneWinners = seededCouples.filter(c => c.zonePosition === 1)
  
  if (zoneWinners.length < 2) {
    return { isValid: true, issues: [], maxSeparation: 0 }
  }
  
  // Check that different zone winners are in different bracket halves (for 2 zones)
  if (zoneWinners.length === 2) {
    const winner1 = zoneWinners[0]
    const winner2 = zoneWinners[1]
    
    if (winner1.bracketPosition === winner2.bracketPosition) {
      issues.push(`Zone winners ${winner1.zoneName} and ${winner2.zoneName} are in the same bracket half`)
    }
  }
  
  // For more zones, check that they alternate properly
  if (zoneWinners.length > 2) {
    const topWinners = zoneWinners.filter(w => w.bracketPosition === 'TOP')
    const bottomWinners = zoneWinners.filter(w => w.bracketPosition === 'BOTTOM')
    
    const difference = Math.abs(topWinners.length - bottomWinners.length)
    if (difference > 1) {
      issues.push(`Unbalanced zone winner distribution: ${topWinners.length} TOP vs ${bottomWinners.length} BOTTOM`)
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    maxSeparation: zoneWinners.length
  }
}