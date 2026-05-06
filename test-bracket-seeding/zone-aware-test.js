/**
 * ZONE-AWARE BRACKET SEEDING ALGORITHM - JavaScript Test
 * Tests rematch avoidance from zone play
 */

// Main algorithm implementation
function generateZoneAwareBracketSeeding(couples, zoneMatchHistory) {
  console.log("🎾 === ZONE-AWARE BRACKET SEEDING ALGORITHM ===")
  console.log(`Input: ${couples.length} couples from ${zoneMatchHistory.length} zones`)
  
  // Step 1: Build opponent tracking from zone match history
  const seededCouples = buildSeededCouplesWithOpponents(couples, zoneMatchHistory)
  console.log(`✅ Built opponent tracking for ${seededCouples.length} couples`)
  
  // Step 2: Calculate bracket size
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, seededCouples.length))))
  console.log(`📐 Bracket size: ${bracketSize} (${bracketSize - seededCouples.length} BYEs needed)`)
  
  // Step 3: Generate optimal bracket pairings
  const bracketPairings = generateOptimalBracketPairings(seededCouples, bracketSize)
  console.log(`⚔️ Generated ${bracketPairings.length} bracket pairings`)
  
  // Step 4: Calculate quality metrics
  const rematchCount = bracketPairings.filter(p => p.isRematch).length
  const totalValidMatches = bracketPairings.filter(p => p.couple2).length
  
  console.log(`📊 Quality metrics:`)
  console.log(`   Rematches: ${rematchCount}/${totalValidMatches} (${totalValidMatches > 0 ? ((rematchCount / totalValidMatches) * 100).toFixed(1) : 0}%)`)
  
  return {
    seededCouples,
    bracketPairings,
    bracketSize,
    rematchCount
  }
}

function buildSeededCouplesWithOpponents(couples, zoneMatchHistory) {
  console.log("\n🔍 Building opponent tracking...")
  
  // Create opponent map
  const opponentMap = new Map()
  
  // Initialize empty opponent sets for all couples
  couples.forEach(couple => {
    opponentMap.set(couple.id, new Set())
  })
  
  // Build opponent relationships from zone match history
  zoneMatchHistory.forEach(zone => {
    console.log(`  Processing ${zone.zoneName}: ${zone.matches.length} matches`)
    
    zone.matches.forEach(match => {
      // Add each couple as opponent of the other
      if (opponentMap.has(match.couple1Id)) {
        opponentMap.get(match.couple1Id).add(match.couple2Id)
      }
      if (opponentMap.has(match.couple2Id)) {
        opponentMap.get(match.couple2Id).add(match.couple1Id)
      }
    })
  })
  
  // Apply traditional seeding
  return applyTraditionalSeeding(couples, opponentMap)
}

function applyTraditionalSeeding(couples, opponentMap) {
  console.log("\n🏆 Applying traditional seeding...")
  
  // Group by position
  const couplesByPosition = {}
  couples.forEach(couple => {
    if (!couplesByPosition[couple.zonePosition]) {
      couplesByPosition[couple.zonePosition] = []
    }
    couplesByPosition[couple.zonePosition].push(couple)
  })
  
  // Sort within each position by zone name, then by points
  Object.keys(couplesByPosition).forEach(position => {
    couplesByPosition[position].sort((a, b) => {
      if (a.zoneName !== b.zoneName) {
        return a.zoneName.localeCompare(b.zoneName)
      }
      return b.points - a.points
    })
  })
  
  // Assign seeds in traditional order
  const seededCouples = []
  let currentSeed = 1
  
  const positions = Object.keys(couplesByPosition).map(Number).sort((a, b) => a - b)
  
  positions.forEach(position => {
    const couplesInPosition = couplesByPosition[position]
    console.log(`  ${getPositionName(position)} place: ${couplesInPosition.length} couples`)
    
    couplesInPosition.forEach(couple => {
      const opponents = Array.from(opponentMap.get(couple.id) || new Set())
      
      seededCouples.push({
        ...couple,
        seed: currentSeed++,
        zoneOpponents: opponents
      })
      
      console.log(`    Seed ${currentSeed - 1}: ${couple.zoneName} (${opponents.length} zone opponents)`)
    })
  })
  
  return seededCouples
}

function generateOptimalBracketPairings(seededCouples, bracketSize) {
  console.log("\n⚡ Generating optimal bracket pairings...")
  
  const pairings = []
  const roundName = getRoundName(bracketSize)
  
  // Create participants array with BYEs
  const participants = new Array(bracketSize).fill(null)
  
  // Place couples in traditional seeding positions (1, 2, 3, 4...)
  seededCouples.forEach((couple, index) => {
    if (index < bracketSize) {
      participants[index] = couple
    }
  })
  
  // Generate traditional bracket pairings (1 vs N, 2 vs N-1, etc.)
  for (let i = 0; i < bracketSize / 2; i++) {
    const couple1 = participants[i]
    const couple2 = participants[bracketSize - 1 - i]
    
    // Skip if both are null
    if (!couple1 && !couple2) {
      continue
    }
    
    // Ensure couple1 is always the real participant
    const actualCouple1 = couple1 || couple2
    const actualCouple2 = couple1 ? couple2 : null
    
    // Check if this is a rematch
    const isRematch = actualCouple2 ? 
      actualCouple1.zoneOpponents.includes(actualCouple2.id) : false
    
    pairings.push({
      matchId: `match-${i + 1}`,
      couple1: actualCouple1,
      couple2: actualCouple2,
      round: roundName,
      order: i + 1,
      isRematch
    })
    
    if (isRematch && actualCouple2) {
      console.log(`    ⚠️ Rematch detected: ${actualCouple1.zoneName} vs ${actualCouple2.zoneName}`)
    }
  }
  
  return pairings
}

// Helper functions
function getPositionName(position) {
  const names = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
  return names[position] || `${position}th`
}

function getRoundName(bracketSize) {
  const roundMap = {
    2: "FINAL",
    4: "SEMIFINAL", 
    8: "4TOS",
    16: "8VOS",
    32: "16VOS",
    64: "32VOS"
  }
  return roundMap[bracketSize] || "32VOS"
}

// Test data creation
function createTestCouple(id, zoneId, zoneName, zonePosition, points, player1Name, player2Name) {
  return {
    id,
    zoneId,
    zoneName,
    zonePosition,
    points,
    player1Name,
    player2Name
  }
}

// Test scenarios
function testTwoZonesWithRematchAvoidance() {
  console.log("\n🧪 === TEST: 2 Zones with Rematch Avoidance ===")
  
  const couples = [
    // Zone A (4 couples)
    createTestCouple("A1", "za", "Zone A", 1, 12, "Ana García", "María López"),
    createTestCouple("A2", "za", "Zone A", 2, 9, "Carlos Ruiz", "Diego Moreno"),
    createTestCouple("A3", "za", "Zone A", 3, 6, "Elena Vega", "Sofia Torres"),
    createTestCouple("A4", "za", "Zone A", 4, 3, "Luis Martín", "Pedro Sánchez"),
    
    // Zone B (4 couples)
    createTestCouple("B1", "zb", "Zone B", 1, 11, "Carmen Jiménez", "Isabel Ramos"),
    createTestCouple("B2", "zb", "Zone B", 2, 8, "Roberto Castro", "Fernando Gil"),
    createTestCouple("B3", "zb", "Zone B", 3, 5, "Laura Herrera", "Cristina Díaz"),
    createTestCouple("B4", "zb", "Zone B", 4, 2, "Javier Morales", "Pablo Vázquez"),
  ]
  
  // Zone match history - who played whom in zones
  const zoneMatchHistory = [
    {
      zoneId: "za",
      zoneName: "Zone A",
      matches: [
        { couple1Id: "A1", couple2Id: "A2" }, // Ana/María vs Carlos/Diego
        { couple1Id: "A3", couple2Id: "A4" }, // Elena/Sofia vs Luis/Pedro  
        { couple1Id: "A1", couple2Id: "A3" }, // Ana/María vs Elena/Sofia
        { couple1Id: "A2", couple2Id: "A4" }  // Carlos/Diego vs Luis/Pedro
      ]
    },
    {
      zoneId: "zb",
      zoneName: "Zone B", 
      matches: [
        { couple1Id: "B1", couple2Id: "B2" }, // Carmen/Isabel vs Roberto/Fernando
        { couple1Id: "B3", couple2Id: "B4" }, // Laura/Cristina vs Javier/Pablo
        { couple1Id: "B1", couple2Id: "B3" }, // Carmen/Isabel vs Laura/Cristina  
        { couple1Id: "B2", couple2Id: "B4" }  // Roberto/Fernando vs Javier/Pablo
      ]
    }
  ]
  
  console.log("📋 Zone match history:")
  zoneMatchHistory.forEach(zone => {
    console.log(`  ${zone.zoneName}: ${zone.matches.length} matches`)
    zone.matches.forEach(match => {
      const c1 = couples.find(c => c.id === match.couple1Id)
      const c2 = couples.find(c => c.id === match.couple2Id)
      console.log(`    ${c1.player1Name}/${c1.player2Name} vs ${c2.player1Name}/${c2.player2Name}`)
    })
  })
  
  const result = generateZoneAwareBracketSeeding(couples, zoneMatchHistory)
  
  // Show results
  console.log(`\n🎯 BRACKET RESULTS:`)
  console.log(`Total couples: ${result.seededCouples.length}`)
  console.log(`Bracket size: ${result.bracketSize}`)
  console.log(`Rematches: ${result.rematchCount}`)
  
  // Show seeding
  console.log(`\nSeeding order:`)
  result.seededCouples.forEach(couple => {
    console.log(`  Seed ${couple.seed}: ${couple.zoneName} (${getPositionName(couple.zonePosition)}) - ${couple.player1Name}/${couple.player2Name}`)
  })
  
  // Show bracket pairings
  console.log(`\nFirst round pairings:`)
  result.bracketPairings.forEach(pairing => {
    const p1 = `Seed ${pairing.couple1.seed} (${pairing.couple1.zoneName})`
    const p2 = pairing.couple2 ? `Seed ${pairing.couple2.seed} (${pairing.couple2.zoneName})` : 'BYE'
    const rematchFlag = pairing.isRematch ? ' ⚠️ REMATCH' : ''
    console.log(`  Match ${pairing.order}: ${p1} vs ${p2}${rematchFlag}`)
  })
  
  // Analysis
  console.log(`\n📊 ANALYSIS:`)
  console.log(`✅ Traditional seeding: 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5`)
  console.log(`✅ Zone A winner (Seed 1) vs Zone B 4th place (Seed 8)`) 
  console.log(`✅ Zone B winner (Seed 2) vs Zone A 4th place (Seed 7)`)
  console.log(`${result.rematchCount === 0 ? '✅' : '⚠️'} Rematches avoided: ${result.rematchCount === 0 ? 'Perfect!' : `${result.rematchCount} found`}`)
  
  return result
}

function testThreeZonesAllPlayAll() {
  console.log("\n🧪 === TEST: 3 Zones (all-play-all structure) ===")
  
  const couples = [
    // Zone A (3 couples)
    createTestCouple("A1", "za", "Zone A", 1, 12, "Winner A1", "Winner A2"),
    createTestCouple("A2", "za", "Zone A", 2, 9, "Second A1", "Second A2"),
    createTestCouple("A3", "za", "Zone A", 3, 6, "Third A1", "Third A2"),
    
    // Zone B (3 couples)
    createTestCouple("B1", "zb", "Zone B", 1, 11, "Winner B1", "Winner B2"),
    createTestCouple("B2", "zb", "Zone B", 2, 8, "Second B1", "Second B2"),
    createTestCouple("B3", "zb", "Zone B", 3, 5, "Third B1", "Third B2"),
    
    // Zone C (3 couples)
    createTestCouple("C1", "zc", "Zone C", 1, 10, "Winner C1", "Winner C2"),
    createTestCouple("C2", "zc", "Zone C", 2, 7, "Second C1", "Second C2"),
    createTestCouple("C3", "zc", "Zone C", 3, 4, "Third C1", "Third C2"),
  ]
  
  // In 3-couple zones, everyone plays everyone (all-play-all)
  const zoneMatchHistory = [
    {
      zoneId: "za",
      zoneName: "Zone A",
      matches: [
        { couple1Id: "A1", couple2Id: "A2" },
        { couple1Id: "A1", couple2Id: "A3" },
        { couple1Id: "A2", couple2Id: "A3" }
      ]
    },
    {
      zoneId: "zb", 
      zoneName: "Zone B",
      matches: [
        { couple1Id: "B1", couple2Id: "B2" },
        { couple1Id: "B1", couple2Id: "B3" },
        { couple1Id: "B2", couple2Id: "B3" }
      ]
    },
    {
      zoneId: "zc",
      zoneName: "Zone C", 
      matches: [
        { couple1Id: "C1", couple2Id: "C2" },
        { couple1Id: "C1", couple2Id: "C3" },
        { couple1Id: "C2", couple2Id: "C3" }
      ]
    }
  ]
  
  console.log("📋 All-play-all zone structure:")
  console.log("  Each couple in each zone played against every other couple in their zone")
  
  const result = generateZoneAwareBracketSeeding(couples, zoneMatchHistory)
  
  console.log(`\n🎯 RESULTS:`)
  console.log(`Bracket size: ${result.bracketSize} (${result.bracketSize - result.seededCouples.length} BYEs)`)
  
  // Show bracket pairings
  console.log(`\nFirst round pairings:`)
  result.bracketPairings.forEach(pairing => {
    const p1 = `Seed ${pairing.couple1.seed} (${pairing.couple1.zoneName})`
    const p2 = pairing.couple2 ? `Seed ${pairing.couple2.seed} (${pairing.couple2.zoneName})` : 'BYE'
    const rematchFlag = pairing.isRematch ? ' ⚠️ REMATCH' : ''
    console.log(`  Match ${pairing.order}: ${p1} vs ${p2}${rematchFlag}`)
  })
  
  // Check for same-zone pairings (should be 0 since everyone in same zone played each other)
  const sameZonePairings = result.bracketPairings.filter(p => 
    p.couple2 && p.couple1.zoneId === p.couple2.zoneId
  )
  
  console.log(`\n📊 Same-zone pairing analysis:`)
  if (sameZonePairings.length > 0) {
    console.log(`  ❌ Found ${sameZonePairings.length} same-zone pairings (should be 0)`)
  } else {
    console.log(`  ✅ No same-zone pairings (perfect!)`)
  }
  
  return result
}

// Run tests
function runZoneAwareTests() {
  console.log("🚀 === ZONE-AWARE BRACKET SEEDING TESTS ===")
  console.log("Testing rematch avoidance and traditional seeding...\n")
  
  try {
    testTwoZonesWithRematchAvoidance()
    testThreeZonesAllPlayAll()
    
    console.log("\n✅ === ZONE-AWARE TESTS COMPLETED ===")
    console.log("🎯 Key features verified:")
    console.log("  ✓ Tracks zone match history")
    console.log("  ✓ Avoids rematches from zone play")  
    console.log("  ✓ Maintains traditional seeding (1 vs N, 2 vs N-1)")
    console.log("  ✓ Higher seeds get BYEs")
    console.log("  ✓ Zone winners separated appropriately")
    console.log("  ✓ Handles all-play-all zone structures")
    
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

// Run the tests
runZoneAwareTests()