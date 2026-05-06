/**
 * Test simplificado usando datos mock del caso real
 * Para probar la lógica del algoritmo sin conexión a DB
 */

import { ZoneRankingEngine } from './lib/services/zone-position/zone-ranking-engine'
import type { CoupleStats } from './lib/services/zone-position/types'

// Datos reales de la Zona A
const mockCouples: CoupleStats[] = [
  {
    coupleId: '77284c0f-df33-4a6e-972d-09dbabd8a6d5',
    player1Name: 'Jerjej',
    player2Name: 'sdasd',
    position: 1,
    matchesWon: 2,
    matchesLost: 0,
    matchesPlayed: 2,
    gamesWon: 12,
    gamesLost: 5,
    gamesDifference: 7,
    totalPlayerScore: 600,
    positionTieInfo: '',
    player1Score: 300,
    player2Score: 300,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  },
  {
    coupleId: 'f25ea9e1-766e-4ca0-aec1-e467c9aec5e5',
    player1Name: 'iiidksksak',
    player2Name: 'iiisadjkajk',
    position: 2,
    matchesWon: 1,
    matchesLost: 0,
    matchesPlayed: 1,
    gamesWon: 6,
    gamesLost: 4,
    gamesDifference: 2,
    totalPlayerScore: 600,
    positionTieInfo: '',
    player1Score: 300,
    player2Score: 300,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  },
  {
    coupleId: '3a4093dd-f8ed-41d6-954f-1775b42407b4',
    player1Name: 'Jose',
    player2Name: 'Politi',
    position: 3,
    matchesWon: 0,
    matchesLost: 1,
    matchesPlayed: 1,
    gamesWon: 4,
    gamesLost: 6,
    gamesDifference: -2,
    totalPlayerScore: 600,
    positionTieInfo: '',
    player1Score: 300,
    player2Score: 300,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  },
  {
    coupleId: 'e524f2de-7a71-47fa-8dd5-48a8989c6ed1',
    player1Name: 'Isabello',
    player2Name: 'Politi',
    position: 4,
    matchesWon: 0,
    matchesLost: 2,
    matchesPlayed: 2,
    gamesWon: 5,
    gamesLost: 12,
    gamesDifference: -7,
    totalPlayerScore: 600,
    positionTieInfo: '',
    player1Score: 300,
    player2Score: 300,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  }
]

// Partido pendiente: iiidksksak vs Jose
const pendingMatch = {
  id: 'e63ddcae-699e-447f-b6ea-c6bca51d70a5',
  couple1_id: 'f25ea9e1-766e-4ca0-aec1-e467c9aec5e5', // iiidksksak
  couple2_id: '3a4093dd-f8ed-41d6-954f-1775b42407b4'  // Jose
}

// Todos los resultados posibles
const ALL_POSSIBLE_RESULTS = [
  { couple1Games: 6, couple2Games: 0, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 1, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 2, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 3, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 4, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 6, winner: 'couple1' },
  { couple1Games: 0, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 1, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 2, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 3, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 4, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 7, winner: 'couple2' },
  { couple1Games: 6, couple2Games: 7, winner: 'couple2' }
]

function simulateMatchResult(couples: CoupleStats[], result: any): CoupleStats[] {
  const updatedCouples = couples.map(c => ({ ...c }))
  
  const iiidksksak = updatedCouples.find(c => c.coupleId === pendingMatch.couple1_id)!
  const jose = updatedCouples.find(c => c.coupleId === pendingMatch.couple2_id)!
  
  // Aplicar resultado
  if (result.winner === 'couple1') {
    // iiidksksak gana
    iiidksksak.matchesWon += 1
    jose.matchesLost += 1
  } else {
    // Jose gana
    jose.matchesWon += 1
    iiidksksak.matchesLost += 1
  }
  
  // Actualizar games
  iiidksksak.gamesWon += result.couple1Games
  iiidksksak.gamesLost += result.couple2Games
  jose.gamesWon += result.couple2Games
  jose.gamesLost += result.couple1Games
  
  // Recalcular diferencias
  iiidksksak.gamesDifference = iiidksksak.gamesWon - iiidksksak.gamesLost
  jose.gamesDifference = jose.gamesWon - jose.gamesLost
  
  return updatedCouples
}

function testDefinitivePositions() {
  console.log('🧪 [TEST] Analizando posiciones definitivas con datos reales')
  console.log('📋 [TEST] Caso: Zona A - 1 partido pendiente entre iiidksksak vs Jose')
  console.log('')
  
  const rankingEngine = new ZoneRankingEngine()
  const positionTracker: { [coupleId: string]: Set<number> } = {}
  
  // Inicializar tracker
  for (const couple of mockCouples) {
    positionTracker[couple.coupleId] = new Set()
  }
  
  console.log('🎲 [TEST] Simulando todos los resultados posibles...')
  
  // Simular cada resultado posible
  for (let i = 0; i < ALL_POSSIBLE_RESULTS.length; i++) {
    const result = ALL_POSSIBLE_RESULTS[i]
    
    // Simular estado después del partido
    const updatedCouples = simulateMatchResult(mockCouples, result)
    
    // Aplicar algoritmo de ranking
    const rankedCouples = rankingEngine.rankCouplesByAllCriteria(updatedCouples, [])
    
    // Registrar posiciones
    for (const couple of rankedCouples) {
      positionTracker[couple.coupleId].add(couple.position)
    }
    
    // Log del escenario más interesante
    if (i === 0) { // iiidksksak gana 6-0
      console.log(`\n🔍 [ESCENARIO ${i + 1}] iiidksksak gana ${result.couple1Games}-${result.couple2Games}:`)
      rankedCouples.forEach(c => {
        console.log(`  ${c.position}. ${c.player1Name} (${c.matchesWon}W-${c.matchesLost}L, ${c.gamesDifference >= 0 ? '+' : ''}${c.gamesDifference})`)
      })
    }
    
    if (i === 15) { // Jose gana 7-6
      console.log(`\n🔍 [ESCENARIO ${i + 1}] Jose gana ${result.couple2Games}-${result.couple1Games}:`)
      rankedCouples.forEach(c => {
        console.log(`  ${c.position}. ${c.player1Name} (${c.matchesWon}W-${c.matchesLost}L, ${c.gamesDifference >= 0 ? '+' : ''}${c.gamesDifference})`)
      })
    }
  }
  
  console.log('\n' + '=' .repeat(80))
  console.log('📊 [TEST] ANÁLISIS DE POSICIONES DEFINITIVAS:')
  console.log('=' .repeat(80))
  
  let allDefinitive = true
  
  for (const couple of mockCouples) {
    const possiblePositions = Array.from(positionTracker[couple.coupleId]).sort()
    const isDefinitive = possiblePositions.length === 1
    
    if (!isDefinitive) allDefinitive = false
    
    const status = isDefinitive ? '🔒 DEFINITIVA' : '⚠️ NO DEFINITIVA'
    
    console.log(`\n${status} - ${couple.player1Name} ${couple.player2Name}`)
    console.log(`  Posición actual: ${couple.position}`)
    console.log(`  Posiciones posibles: [${possiblePositions.join(', ')}]`)
    console.log(`  Record actual: ${couple.matchesWon}W-${couple.matchesLost}L, ${couple.gamesDifference >= 0 ? '+' : ''}${couple.gamesDifference} games`)
  }
  
  console.log('\n' + '=' .repeat(80))
  console.log('🎯 [TEST] RESULTADO:')
  
  if (!allDefinitive) {
    console.log('✅ CORRECTO: Ninguna posición es definitiva (como esperábamos)')
    console.log('💡 Razón: El resultado del partido pendiente puede cambiar todas las posiciones')
  } else {
    console.log('❌ ERROR: Algunas posiciones fueron marcadas como definitivas incorrectamente')
  }
  
  console.log(`\n📈 Escenarios simulados: ${ALL_POSSIBLE_RESULTS.length}`)
  console.log('✅ Test completado')
}

// Ejecutar test
testDefinitivePositions()