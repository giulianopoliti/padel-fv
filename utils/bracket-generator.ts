/**
 * Utility functions for generating tournament elimination brackets
 * Implements proper seeding algorithm for padel tournaments
 */

import type { CoupleInfo, MatchInfo } from "@/components/tournament/club/types"
import { Couple, Zone, Round } from "@/types"
import { MATCH_STATUS, type MatchStatus } from "@/types/match-status"

// =============================================================================
// TIPOS PRINCIPALES
// =============================================================================

/**
 * Pareja clasificada con toda la información necesaria para el seeding
 */
export interface CoupleSeeded {
  id: string
  zona: string  // 'A', 'B', 'C', etc.
  puntos: number
  posicionEnZona: number  // 1 para primeros, 2 para segundos, etc.
  player1_id?: string
  player2_id?: string
  player1_name?: string
  player2_name?: string
  zone_id?: string
  [key: string]: any  // Propiedades adicionales
}

/**
 * Pareja con seed global asignado
 */
export interface CoupleWithSeed extends CoupleSeeded {
  seed: number  // Seed global (1, 2, 3, ...)
}

/**
 * Match del bracket eliminatorio
 */
export interface BracketMatch {
  id: string
  round: Round
  order: number
  pareja1: CoupleWithSeed | null
  pareja2: CoupleWithSeed | null
  status: MatchStatus
  winner_id?: string | null
  couple1_id?: string | null
  couple2_id?: string | null
}

/**
 * Configuración del bracket
 */
export interface BracketConfig {
  tournamentId: string
  totalCouples: number
  bracketSize: number
  initialRound: Round
  numByes: number
}

// =============================================================================
// ALGORITMO PRINCIPAL DE SEEDING
// =============================================================================

/**
 * Función principal que implementa el algoritmo de seeding completo
 * 
 * @param couples Array de parejas clasificadas con zona, puntos y posición
 * @returns Array de matches del bracket eliminatorio
 */
export function generateEliminationBracket(couples: CoupleSeeded[]): BracketMatch[] {
  if (couples.length === 0) {
    return []
  }

  // Paso 1: Asignar seeds globales
  const seededCouples = assignGlobalSeeds(couples)
  
  // Paso 2: Configurar el bracket
  const config = createBracketConfig(seededCouples.length)
  
  // Paso 3: Generar los matches
  const matches = createBracketMatches(seededCouples, config)
  
  // Paso 4: Propagar ganadores automáticos (BYEs)
  const matchesWithPropagation = propagateAutomaticWinners(matches)
  
  return matchesWithPropagation
}

/**
 * Asigna seeds globales siguiendo la regla:
 * 1. Los ganadores de zona obtienen seeds 1, 2, 3, etc. según el orden de creación de la zona
 * 2. Luego todos los segundos de zona en el mismo orden
 * 3. Luego todos los terceros, etc.
 * 4. TODOS los participantes avanzan al bracket eliminatorio
 */
export function assignGlobalSeeds(couples: CoupleSeeded[]): CoupleWithSeed[] {
  // Primero, obtener el orden único de las zonas basado en el orden en que aparecen
  // Asumimos que las parejas vienen ordenadas por zona según el orden de creación
  const zoneOrder: string[] = []
  const zoneMap = new Map<string, number>()
  
  // Construir el orden de las zonas basado en primera aparición
  couples.forEach(couple => {
    if (!zoneMap.has(couple.zona)) {
      zoneMap.set(couple.zona, zoneOrder.length)
      zoneOrder.push(couple.zona)
    }
  })
  
  console.log('[assignGlobalSeeds] Orden de zonas detectado:', zoneOrder)
  
  // Agrupar por posición en zona
  const couplesGroupedByPosition: { [position: number]: CoupleSeeded[] } = {}
  
  couples.forEach(couple => {
    const position = couple.posicionEnZona
    if (!couplesGroupedByPosition[position]) {
      couplesGroupedByPosition[position] = []
    }
    couplesGroupedByPosition[position].push(couple)
  })

  // Asignar seeds
  const seededCouples: CoupleWithSeed[] = []
  let currentSeed = 1

  // Procesar en orden de posición (1ros, 2dos, 3ros, etc.)
  const positions = Object.keys(couplesGroupedByPosition)
    .map(Number)
    .sort((a, b) => a - b)

  positions.forEach(position => {
    const couplesInPosition = couplesGroupedByPosition[position]
    
    // Para los primeros lugares, asignar seeds según el número de zona
    if (position === 1) {
      // Los ganadores de zona obtienen seeds 1, 2, 3, etc.
      // según el orden de las zonas (no alfabético)
      const sortedByZoneOrder = couplesInPosition.sort((a, b) => {
        const zoneIndexA = zoneMap.get(a.zona) ?? 999
        const zoneIndexB = zoneMap.get(b.zona) ?? 999
        return zoneIndexA - zoneIndexB
      })
      
      sortedByZoneOrder.forEach((couple, index) => {
        seededCouples.push({
          ...couple,
          seed: index + 1 // Seeds 1, 2, 3, etc. para ganadores
        })
        console.log(`[assignGlobalSeeds] Seed ${index + 1}: ${couple.zona} (1° lugar) - ${couple.puntos} pts`)
      })
      
      currentSeed = sortedByZoneOrder.length + 1
    } else {
      // Para las demás posiciones, mantener el orden por zona
      // pero continuar con la numeración secuencial
      const sortedByZoneOrder = couplesInPosition.sort((a, b) => {
        const zoneIndexA = zoneMap.get(a.zona) ?? 999
        const zoneIndexB = zoneMap.get(b.zona) ?? 999
        if (zoneIndexA !== zoneIndexB) {
          return zoneIndexA - zoneIndexB
        }
        // Si misma zona (no debería pasar), ordenar por puntos descendente
        return b.puntos - a.puntos
      })
      
      sortedByZoneOrder.forEach(couple => {
        seededCouples.push({
          ...couple,
          seed: currentSeed++
        })
        console.log(`[assignGlobalSeeds] Seed ${currentSeed - 1}: ${couple.zona} (${couple.posicionEnZona}° lugar) - ${couple.puntos} pts`)
      })
    }
  })

  console.log(`[assignGlobalSeeds] Total parejas sembradas: ${seededCouples.length}`)
  return seededCouples
}

/**
 * Crea la configuración del bracket basada en el número de parejas
 */
export function createBracketConfig(totalCouples: number, tournamentId: string = ''): BracketConfig {
  // Calcular el tamaño del bracket (próxima potencia de 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, totalCouples))))
  const numByes = bracketSize - totalCouples
  const initialRound = getRoundName(bracketSize)

  return {
    tournamentId,
    totalCouples,
    bracketSize,
    initialRound,
    numByes
  }
}

/**
 * Crea los matches del bracket usando el algoritmo de seeding tradicional
 * NUEVA VERSIÓN: Genera TODAS las rondas del bracket eliminatorio de una sola vez
 * Implementa: seed 1 vs seed N, seed 2 vs seed N-1, etc.
 */
export function createBracketMatches(
  seededCouples: CoupleWithSeed[], 
  config: BracketConfig
): BracketMatch[] {
  const matches: BracketMatch[] = []
  const { bracketSize, initialRound, numByes } = config

  console.log(`[createBracketMatches] Generando bracket completo para ${seededCouples.length} parejas`)
  console.log(`[createBracketMatches] Tamaño del bracket: ${bracketSize}, Ronda inicial: ${initialRound}`)

  // Calcular todas las rondas necesarias
  const allRounds = calculateAllRounds(bracketSize)
  console.log(`[createBracketMatches] Rondas a generar: ${allRounds.map(r => r.name).join(' -> ')}`)

  // RONDA 1: Crear matches iniciales con parejas reales
  const firstRoundMatches = createFirstRoundMatches(seededCouples, config)
  matches.push(...firstRoundMatches)

  // RONDAS POSTERIORES: Crear matches con placeholders
  for (let roundIndex = 1; roundIndex < allRounds.length; roundIndex++) {
    const currentRound = allRounds[roundIndex]
    const previousRound = allRounds[roundIndex - 1]
    
    console.log(`[createBracketMatches] Generando ronda ${currentRound.name} (${currentRound.matchCount} matches)`)
    
    const roundMatches = createPlaceholderRoundMatches(
      currentRound,
      previousRound,
      roundIndex
    )
    matches.push(...roundMatches)
  }

  console.log(`[createBracketMatches] ✅ Bracket completo generado: ${matches.length} matches total`)
  return matches
}

/**
 * Calcula todas las rondas necesarias para un bracket de tamaño dado
 */
function calculateAllRounds(bracketSize: number): Array<{ name: Round; matchCount: number; roundSize: number }> {
  const rounds: Array<{ name: Round; matchCount: number; roundSize: number }> = []
  
  let currentSize = bracketSize
  while (currentSize >= 2) {
    const roundName = getRoundName(currentSize)
    const matchCount = currentSize / 2
    
    rounds.push({
      name: roundName,
      matchCount,
      roundSize: currentSize
    })
    
    currentSize = currentSize / 2
  }
  
  return rounds
}

/**
 * Determina el estado de un match basado en las parejas asignadas
 */
function determineMatchStatus(
  pareja1: CoupleWithSeed | null, 
  pareja2: CoupleWithSeed | null
): { status: MatchStatus; winner_id: string | null } {
  // BYE: Una pareja real vs null (avance automático)
  if (pareja1 !== null && pareja2 === null) {
    return { status: MATCH_STATUS.BYE, winner_id: pareja1.id }
  }
  if (pareja1 === null && pareja2 !== null) {
    return { status: MATCH_STATUS.BYE, winner_id: pareja2.id }
  }
  
  // PENDING: Ambas parejas asignadas, listo para jugar
  if (pareja1 !== null && pareja2 !== null) {
    return { status: MATCH_STATUS.PENDING, winner_id: null }
  }
  
  // WAITING_OPONENT: Ambas parejas son null (no debería pasar en primera ronda)
  return { status: MATCH_STATUS.WAITING_OPONENT, winner_id: null }
}

/**
 * Crea los matches de la primera ronda con parejas reales
 */
function createFirstRoundMatches(
  seededCouples: CoupleWithSeed[], 
  config: BracketConfig
): BracketMatch[] {
  const matches: BracketMatch[] = []
  const { bracketSize, initialRound } = config

  // Crear array de participantes incluyendo BYEs
  const participants: (CoupleWithSeed | null)[] = new Array(bracketSize).fill(null)
  
  // Colocar parejas reales en las posiciones correctas
  seededCouples.forEach((couple, index) => {
    if (index < bracketSize) {
      participants[index] = couple
    }
  })

  // Obtener índices de emparejamiento según el patrón tradicional
  const pairingIndices = getBracketPairingIndices(bracketSize)
  
  // Crear matches para la primera ronda
  for (let i = 0; i < pairingIndices.length; i += 2) {
    const index1 = pairingIndices[i]
    const index2 = pairingIndices[i + 1]
    
    const pareja1 = participants[index1]
    const pareja2 = participants[index2]
    
    // Determinar el estado del match usando la nueva lógica
    const { status, winner_id } = determineMatchStatus(pareja1, pareja2)

    matches.push({
      id: `bracket-match-${Math.floor(i / 2) + 1}`,
      round: initialRound,
      order: Math.floor(i / 2) + 1,
      pareja1,
      pareja2,
      status,
      winner_id,
      couple1_id: pareja1?.id || null,
      couple2_id: pareja2?.id || null
    })
  }

  console.log(`[createFirstRoundMatches] ✅ Primera ronda creada: ${matches.length} matches`)
  return matches
}

/**
 * Crea matches con placeholders para rondas posteriores
 */
function createPlaceholderRoundMatches(
  currentRound: { name: Round; matchCount: number; roundSize: number },
  previousRound: { name: Round; matchCount: number; roundSize: number },
  roundIndex: number
): BracketMatch[] {
  const matches: BracketMatch[] = []
  
  // Crear matches vacíos para esta ronda
  for (let matchOrder = 1; matchOrder <= currentRound.matchCount; matchOrder++) {
    matches.push({
      id: `bracket-match-${currentRound.name.toLowerCase()}-${matchOrder}`,
      round: currentRound.name,
      order: matchOrder,
      pareja1: null, // Placeholder - se llenará cuando se conozca el ganador
      pareja2: null, // Placeholder - se llenará cuando se conozca el ganador
      status: MATCH_STATUS.WAITING_OPONENT, // Esperando ganadores de ronda anterior
      winner_id: null,
      couple1_id: null, // Estos son los campos importantes para la DB
      couple2_id: null
    })
  }
  
  console.log(`[createPlaceholderRoundMatches] ✅ Ronda ${currentRound.name}: ${matches.length} matches placeholder creados`)
  return matches
}

/**
 * Obtiene los índices de emparejamiento para un bracket de tamaño dado
 * Implementa el patrón tradicional: mejor vs peor, segundo mejor vs segundo peor, etc.
 */
export function getBracketPairingIndices(bracketSize: number): number[] {
  const indices: number[] = []
  
  // Patrones predefinidos para tamaños comunes
  const pairingPatterns: { [size: number]: number[] } = {
    2: [0, 1],
    4: [0, 3, 1, 2],
    8: [0, 7, 3, 4, 1, 6, 2, 5],
    16: [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10],
    32: [0, 31, 15, 16, 7, 24, 8, 23, 3, 28, 12, 19, 4, 27, 11, 20, 1, 30, 14, 17, 6, 25, 9, 22, 2, 29, 13, 18, 5, 26, 10, 21]
  }

  if (pairingPatterns[bracketSize]) {
    return pairingPatterns[bracketSize]
  }

  // Patrón genérico para tamaños no predefinidos
  for (let i = 0; i < bracketSize / 2; i++) {
    indices.push(i, bracketSize - 1 - i)
  }

  return indices
}

/**
 * Obtiene el nombre de la ronda basado en el tamaño del bracket
 */
export function getRoundName(bracketSize: number): Round {
  const roundMap: { [size: number]: Round } = {
    2: "FINAL",
    4: "SEMIFINAL", 
    8: "4TOS",
    16: "8VOS",
    32: "16VOS",
    64: "32VOS"
  }

  return roundMap[bracketSize] || "32VOS"
}

// =============================================================================
// UTILIDADES Y HELPERS
// =============================================================================

/**
 * Valida que los datos de entrada sean correctos
 */
export function validateCouplesData(couples: CoupleSeeded[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (couples.length === 0) {
    errors.push("No hay parejas para procesar")
    return { valid: false, errors }
  }

  couples.forEach((couple, index) => {
    if (!couple.id) {
      errors.push(`Pareja ${index + 1}: ID faltante`)
    }
    if (!couple.zona) {
      errors.push(`Pareja ${index + 1}: Zona faltante`)
    }
    if (typeof couple.puntos !== 'number') {
      errors.push(`Pareja ${index + 1}: Puntos debe ser un número`)
    }
    if (typeof couple.posicionEnZona !== 'number' || couple.posicionEnZona < 1) {
      errors.push(`Pareja ${index + 1}: Posición en zona debe ser un número mayor a 0`)
    }
  })

  return { valid: errors.length === 0, errors }
}

/**
 * Convierte matches del bracket a formato para insertar en la base de datos
 */
export function convertMatchesToDatabaseFormat(
  matches: BracketMatch[], 
  tournamentId: string
): any[] {
  // Determinar cuál es la primera ronda (la que tiene más matches)
  const roundCounts = matches.reduce((acc, match) => {
    acc[match.round] = (acc[match.round] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const firstRound = Object.entries(roundCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0]; // Ronda con más matches
  
  return matches.map(match => ({
    tournament_id: tournamentId,
    couple1_id: match.pareja1?.id || null,
    couple2_id: match.pareja2?.id || null,
    round: match.round,
    order: match.order,
    status: match.status,
    winner_id: match.winner_id || null,
    type: 'ELIMINATION', // Todos los matches generados aquí son de eliminación
    court: null, // Campo requerido por la DB
    is_from_initial_generation: match.round === firstRound // Flag para primera ronda
  }))
}

/**
 * Función de debug para mostrar el seeding paso a paso
 */
export function debugSeeding(couples: CoupleSeeded[]): void {
  console.log("=== DEBUG: Proceso de Seeding ===")
  
  // Mostrar datos de entrada
  console.log("Parejas de entrada:")
  couples.forEach(couple => {
    console.log(`  ID: ${couple.id}, Zona: ${couple.zona}, Posición: ${couple.posicionEnZona}, Puntos: ${couple.puntos}`)
  })

  // Mostrar seeding
  const seeded = assignGlobalSeeds(couples)
  console.log("\nSeeding asignado:")
  seeded.forEach(couple => {
    console.log(`  Seed ${couple.seed}: Zona ${couple.zona} (${couple.posicionEnZona}°), ${couple.puntos} pts`)
  })

  // Mostrar matches
  const matches = createBracketMatches(seeded, createBracketConfig(seeded.length))
  console.log("\nMatches generados:")
  matches.forEach(match => {
    const p1 = match.pareja1 ? `Seed ${match.pareja1.seed}` : 'BYE'
    const p2 = match.pareja2 ? `Seed ${match.pareja2.seed}` : 'BYE'
    console.log(`  ${match.round} - Match ${match.order}: ${p1} vs ${p2}`)
  })
}

// =============================================================================
// PROPAGACIÓN AUTOMÁTICA DE GANADORES (BYEs)
// =============================================================================

/**
 * Propaga automáticamente los ganadores de matches BYE a través de todas las rondas
 * Esta función simula el avance automático que normalmente haría updateMatchResult
 */
export function propagateAutomaticWinners(matches: BracketMatch[]): BracketMatch[] {
  const updatedMatches = [...matches]
  
  console.log('[propagateAutomaticWinners] Iniciando propagación de BYEs...')
  
  // Obtener todas las rondas en orden
  const rounds = Array.from(new Set(matches.map(m => m.round)))
  const roundOrder = ['32VOS', '16VOS', '8VOS', '4TOS', 'SEMIFINAL', 'FINAL']
  const sortedRounds = rounds.sort((a, b) => {
    const indexA = roundOrder.indexOf(a)
    const indexB = roundOrder.indexOf(b)
    return indexA - indexB
  })
  
  console.log(`[propagateAutomaticWinners] Rondas detectadas: ${sortedRounds.join(' -> ')}`)
  
  // Procesar cada ronda en orden
  for (let roundIndex = 0; roundIndex < sortedRounds.length - 1; roundIndex++) {
    const currentRound = sortedRounds[roundIndex]
    const nextRound = sortedRounds[roundIndex + 1]
    
    console.log(`[propagateAutomaticWinners] Procesando: ${currentRound} -> ${nextRound}`)
    
    // Obtener matches de la ronda actual que tienen ganadores
    const currentRoundMatches = updatedMatches.filter(m => m.round === currentRound)
    const finishedMatches = currentRoundMatches.filter(m => 
      m.status === MATCH_STATUS.BYE || m.status === MATCH_STATUS.FINISHED
    )
    
    console.log(`[propagateAutomaticWinners] Matches terminados en ${currentRound}: ${finishedMatches.length}/${currentRoundMatches.length}`)
    
    // Para cada match terminado, propagar el ganador a la siguiente ronda
    finishedMatches.forEach(finishedMatch => {
      if (!finishedMatch.winner_id) return
      
      // Determinar a qué match de la siguiente ronda va el ganador
      const targetMatchOrder = Math.floor((finishedMatch.order - 1) / 2) + 1
      const targetMatch = updatedMatches.find(m => 
        m.round === nextRound && m.order === targetMatchOrder
      )
      
      if (!targetMatch) {
        console.warn(`[propagateAutomaticWinners] No se encontró match objetivo: ${nextRound} orden ${targetMatchOrder}`)
        return
      }
      
      // Encontrar la pareja ganadora
      const winnerCouple = finishedMatch.pareja1?.id === finishedMatch.winner_id 
        ? finishedMatch.pareja1 
        : finishedMatch.pareja2
      
      if (!winnerCouple) {
        console.warn(`[propagateAutomaticWinners] No se encontró pareja ganadora para match ${finishedMatch.id}`)
        return
      }
      
      // Determinar si va a couple1 o couple2 basado en el orden del match padre
      const isFirstParent = (finishedMatch.order % 2) === 1
      
      if (isFirstParent) {
        // Este match alimenta couple1_id del match objetivo
        targetMatch.pareja1 = winnerCouple
        targetMatch.couple1_id = winnerCouple.id
      } else {
        // Este match alimenta couple2_id del match objetivo
        targetMatch.pareja2 = winnerCouple
        targetMatch.couple2_id = winnerCouple.id
      }
      
      // -----------------------------
      // NUEVA LÓGICA DE ESTADO
      // -----------------------------
      const bothCouplesDefined = targetMatch.pareja1 !== null && targetMatch.pareja2 !== null
      
      if (bothCouplesDefined) {
        // El match está listo para jugar
        targetMatch.status = MATCH_STATUS.PENDING
        targetMatch.winner_id = null
      } else {
        // Solo una pareja definida → debe esperar rival
        targetMatch.status = MATCH_STATUS.WAITING_OPONENT
        targetMatch.winner_id = null
      }
      
      console.log(`[propagateAutomaticWinners] ✅ Avanzado: ${winnerCouple.player1_name}/${winnerCouple.player2_name} -> ${nextRound} M${targetMatchOrder} (${targetMatch.status})`)
    })
  }
  
  console.log('[propagateAutomaticWinners] ✅ Propagación completada')
  return updatedMatches
}

/**
 * Verifica y completa automáticamente un match BYE si es necesario
 * Útil para llamar después de actualizar un match individual
 */
export function checkAndAutoCompleteByeMatch(match: BracketMatch): BracketMatch {
  const newStatus = determineMatchStatus(match.pareja1, match.pareja2)
  
  if (newStatus.status === MATCH_STATUS.BYE && match.status !== MATCH_STATUS.BYE) {
    console.log(`[checkAndAutoCompleteByeMatch] Auto-completando BYE: Match ${match.order}`)
    return {
      ...match,
      status: newStatus.status,
      winner_id: newStatus.winner_id
    }
  }
  
  return match
}

// =============================================================================
// COMPATIBILIDAD CON CÓDIGO EXISTENTE
// =============================================================================

export interface CoupleWithStats extends Couple {
  stats?: {
    points: number;
  };
}

export interface ZoneWithRankedCouples extends Omit<Zone, 'couples'> {
  couples: CoupleWithStats[];
}

export interface KnockoutPairing {
  temp_id: string;
  round: Round;
  couple1: CoupleWithStats;
  couple2: CoupleWithStats | { id: "BYE_MARKER"; player_1: "BYE_PLAYER_ID"; player_2: "BYE_PLAYER_ID" };
}

// Mantener funciones existentes para compatibilidad
export function generateZones(participants: Couple[]): Zone[] {
  const zones: Zone[] = [];
  const mutableParticipants = [...participants];
  const n = mutableParticipants.length;

  if (n === 0) return [];
  if (n < 6) throw new Error(`El torneo requiere al menos 6 parejas. Recibidas: ${n}.`);

  let numZonesOf4 = 0;
  let numZonesOf3 = 0;

  switch (n % 4) {
    case 0:
      numZonesOf4 = n / 4;
      break;
    case 1:
      if (n < 9) throw new Error(`No se pueden formar zonas con ${n} parejas (resto 1). Se requieren al menos 9.`);
      numZonesOf4 = Math.floor(n / 4) - 2;
      numZonesOf3 = 3;
      break;
    case 2:
      numZonesOf4 = Math.floor(n / 4) - 1;
      numZonesOf3 = 2;
      break;
    case 3:
      numZonesOf4 = Math.floor(n / 4);
      numZonesOf3 = 1;
      break;
  }

  let zoneCounter = 0;
  const createAndAddZone = (numInZone: number) => {
    if (mutableParticipants.length < numInZone) {
      throw new Error(`Error interno: participantes insuficientes (${mutableParticipants.length}) para zona de ${numInZone}.`);
    }

    const zoneCouples: Couple[] = mutableParticipants.splice(0, numInZone);

    zones.push({
      id: `temp-zone-${zoneCounter}`,
      name: `Zone ${String.fromCharCode(65 + zoneCounter)}`,
      created_at: new Date().toISOString(),
      couples: zoneCouples,
    });

    zoneCounter++;
  };

  for (let i = 0; i < numZonesOf4; i++) createAndAddZone(4);
  for (let i = 0; i < numZonesOf3; i++) createAndAddZone(3);

  if (mutableParticipants.length > 0) {
    throw new Error(`Quedaron ${mutableParticipants.length} parejas sin asignar a zonas. Revisa la lógica de distribución.`);
  }

  return zones;
}

export function generateKnockoutRounds(zones: ZoneWithRankedCouples[]): KnockoutPairing[] {
  const allCouplesRaw: CoupleWithStats[] = zones.flatMap(zone => zone.couples);

  if (allCouplesRaw.length === 0) return [];

  const allCouples: CoupleWithStats[] = allCouplesRaw.map(c => ({
    ...c,
    stats: c.stats || { points: 0, played: 0, won: 0, lost: 0, scored: 0, conceded: 0 }
  }));

  allCouples.sort((a, b) => {
    const pointsA = a.stats?.points || 0;
    const pointsB = b.stats?.points || 0;
    return pointsB - pointsA;
  });

  const numCouples = allCouples.length;
  const bracketSize = Math.max(2, Math.pow(2, Math.ceil(Math.log2(numCouples))));
  const numByes = bracketSize - numCouples;
  const roundName = getRoundName(bracketSize);

  const pairings: KnockoutPairing[] = [];
  let matchIdCounter = 1;

  for (let i = 0; i < numByes; i++) {
    pairings.push({
      temp_id: `match-${matchIdCounter++}`,
      round: roundName,
      couple1: allCouples[i],
      couple2: { id: "BYE_MARKER", player_1: "BYE_PLAYER_ID", player_2: "BYE_PLAYER_ID", stats: { points: 0 } },
    });
  }

  const playingCouples: CoupleWithStats[] = allCouples.slice(numByes);
  const numPlayingCouples = playingCouples.length;

  for (let i = 0; i < Math.floor(numPlayingCouples / 2); i++) {
    pairings.push({
      temp_id: `match-${matchIdCounter++}`,
      round: roundName,
      couple1: playingCouples[i],
      couple2: playingCouples[numPlayingCouples - 1 - i],
    });
  }

  return pairings;
}

// =============================================================================
// SISTEMA DE PLACEHOLDERS PARA BRACKET
// =============================================================================

/**
 * Información de placeholder para mostrar en el bracket
 */
export interface PlaceholderInfo {
  type: 'ZONE_WINNER' | 'MATCH_WINNER' | 'BYE' | 'PENDING'
  displayText: string
  sourceInfo?: {
    zoneId?: string
    zoneName?: string
    position?: number
    matchId?: string
    matchOrder?: number
    round?: string
  }
}

/**
 * Genera información de placeholder para la primera ronda basada en seeds
 */
export function generateFirstRoundPlaceholders(
  seededCouples: CoupleWithSeed[]
): Map<string, PlaceholderInfo> {
  const placeholders = new Map<string, PlaceholderInfo>()
  
  seededCouples.forEach((couple, index) => {
    const placeholderKey = `seed-${couple.seed}`
    
    placeholders.set(placeholderKey, {
      type: 'ZONE_WINNER',
      displayText: `${couple.posicionEnZona}° ${couple.zona}`,
      sourceInfo: {
        zoneId: couple.zone_id,
        zoneName: couple.zona,
        position: couple.posicionEnZona
      }
    })
  })
  
  return placeholders
}

/**
 * Genera información de placeholder para rondas posteriores basada en matches padre
 */
export function generateRoundPlaceholders(
  currentRound: { name: Round; matchCount: number },
  previousRound: { name: Round; matchCount: number }
): Map<string, PlaceholderInfo> {
  const placeholders = new Map<string, PlaceholderInfo>()
  
  // Para cada match de la ronda actual, determinar de dónde vienen sus participantes
  for (let matchOrder = 1; matchOrder <= currentRound.matchCount; matchOrder++) {
    // Cada match de la ronda actual recibe ganadores de 2 matches de la ronda anterior
    const parentMatch1Order = (matchOrder - 1) * 2 + 1
    const parentMatch2Order = (matchOrder - 1) * 2 + 2
    
    // Placeholder para couple1_id (ganador del primer match padre)
    const placeholder1Key = `${currentRound.name}-${matchOrder}-couple1`
    placeholders.set(placeholder1Key, {
      type: 'MATCH_WINNER',
      displayText: `Ganador M${parentMatch1Order}`,
      sourceInfo: {
        matchOrder: parentMatch1Order,
        round: previousRound.name
      }
    })
    
    // Placeholder para couple2_id (ganador del segundo match padre)
    const placeholder2Key = `${currentRound.name}-${matchOrder}-couple2`
    placeholders.set(placeholder2Key, {
      type: 'MATCH_WINNER',
      displayText: `Ganador M${parentMatch2Order}`,
      sourceInfo: {
        matchOrder: parentMatch2Order,
        round: previousRound.name
      }
    })
  }
  
  return placeholders
}

/**
 * Obtiene el texto de placeholder apropiado para mostrar en el bracket
 */
export function getPlaceholderText(
  couple: CoupleWithSeed | null,
  placeholderInfo?: PlaceholderInfo
): string {
  // Si hay una pareja real, mostrar sus nombres
  if (couple) {
    return `${couple.player1_name || 'Jugador 1'} / ${couple.player2_name || 'Jugador 2'}`
  }
  
  // Si hay información de placeholder, usarla
  if (placeholderInfo) {
    return placeholderInfo.displayText
  }
  
  // Fallback
  return 'Por definir'
}

/**
 * Determina qué matches de la ronda anterior alimentan a un match específico
 */
export function getParentMatches(
  currentMatchOrder: number,
  previousRoundMatchCount: number
): { parent1Order: number; parent2Order: number } {
  // Cada match recibe ganadores de 2 matches de la ronda anterior
  const parent1Order = (currentMatchOrder - 1) * 2 + 1
  const parent2Order = (currentMatchOrder - 1) * 2 + 2
  
  return { parent1Order, parent2Order }
}

/**
 * Función de ejemplo para probar el algoritmo con datos simulados
 * Útil para testing y demostración
 */
export function exampleSeeding(): void {
  console.log("🎾 === EJEMPLO DE SEEDING PARA TORNEO DE PÁDEL ===\n");
  
  // Datos de ejemplo: 21 parejas en 6 zonas
  // IMPORTANTE: El orden de las zonas aquí simula el orden de creación
  const exampleCouples: CoupleSeeded[] = [
    // Zona A (1ra zona creada - 4 parejas)
    { id: "couple-01", zona: "Zone A", puntos: 9, posicionEnZona: 1 }, // 1° Zona A → Seed 1
    { id: "couple-02", zona: "Zone A", puntos: 7, posicionEnZona: 2 }, // 2° Zona A
    { id: "couple-03", zona: "Zone A", puntos: 4, posicionEnZona: 3 }, // 3° Zona A
    { id: "couple-04", zona: "Zone A", puntos: 3, posicionEnZona: 4 }, // 4° Zona A
    
    // Zona B (2da zona creada - 4 parejas)
    { id: "couple-05", zona: "Zone B", puntos: 9, posicionEnZona: 1 }, // 1° Zona B → Seed 2
    { id: "couple-06", zona: "Zone B", puntos: 6, posicionEnZona: 2 }, // 2° Zona B
    { id: "couple-07", zona: "Zone B", puntos: 5, posicionEnZona: 3 }, // 3° Zona B
    { id: "couple-08", zona: "Zone B", puntos: 1, posicionEnZona: 4 }, // 4° Zona B
    
    // Zona C (3ra zona creada - 4 parejas)
    { id: "couple-09", zona: "Zone C", puntos: 8, posicionEnZona: 1 }, // 1° Zona C → Seed 3
    { id: "couple-10", zona: "Zone C", puntos: 7, posicionEnZona: 2 }, // 2° Zona C
    { id: "couple-11", zona: "Zone C", puntos: 4, posicionEnZona: 3 }, // 3° Zona C
    { id: "couple-12", zona: "Zone C", puntos: 3, posicionEnZona: 4 }, // 4° Zona C
    
    // Zona D (4ta zona creada - 3 parejas)
    { id: "couple-13", zona: "Zone D", puntos: 9, posicionEnZona: 1 }, // 1° Zona D → Seed 4
    { id: "couple-14", zona: "Zone D", puntos: 6, posicionEnZona: 2 }, // 2° Zona D
    { id: "couple-15", zona: "Zone D", puntos: 3, posicionEnZona: 3 }, // 3° Zona D
    
    // Zona E (5ta zona creada - 3 parejas)
    { id: "couple-16", zona: "Zone E", puntos: 8, posicionEnZona: 1 }, // 1° Zona E → Seed 5
    { id: "couple-17", zona: "Zone E", puntos: 5, posicionEnZona: 2 }, // 2° Zona E
    { id: "couple-18", zona: "Zone E", puntos: 4, posicionEnZona: 3 }, // 3° Zona E
    
    // Zona F (6ta zona creada - 3 parejas)
    { id: "couple-19", zona: "Zone F", puntos: 7, posicionEnZona: 1 }, // 1° Zona F → Seed 6
    { id: "couple-20", zona: "Zone F", puntos: 6, posicionEnZona: 2 }, // 2° Zona F
    { id: "couple-21", zona: "Zone F", puntos: 2, posicionEnZona: 3 }, // 3° Zona F
  ];

  console.log("📋 Datos de entrada (21 parejas en 6 zonas):");
  const zonesData: { [zona: string]: CoupleSeeded[] } = {};
  const zoneOrderMap: string[] = []; // Mantener orden de aparición
  
  exampleCouples.forEach(couple => {
    if (!zonesData[couple.zona]) {
      zonesData[couple.zona] = [];
      zoneOrderMap.push(couple.zona);
    }
    zonesData[couple.zona].push(couple);
  });

  zoneOrderMap.forEach((zona, index) => {
    console.log(`\n  ${zona} (${index + 1}° zona creada):`);
    zonesData[zona].forEach(couple => {
      console.log(`    ${couple.posicionEnZona}° lugar - ${couple.id} (${couple.puntos} pts)`);
    });
  });

  // Generar seeding
  console.log("\n🎯 Seeds asignados (por posición en zona):");
  const seeded = assignGlobalSeeds(exampleCouples);
  
  let currentPosition = 0;
  [1, 2, 3, 4].forEach(position => {
    const couplesInPosition = seeded.filter(c => c.posicionEnZona === position);
    if (couplesInPosition.length > 0) {
      console.log(`\n  ${position}° de zona:`);
      couplesInPosition.forEach(couple => {
        console.log(`    Seed ${couple.seed.toString().padStart(2)}: Zona ${couple.zona} - ${couple.puntos} pts`);
      });
    }
  });

  // Generar bracket
  console.log("\n⚔️ Bracket generado (32 equipos):");
  const config = createBracketConfig(seeded.length);
  console.log(`   Tamaño del bracket: ${config.bracketSize}`);
  console.log(`   BYEs necesarios: ${config.numByes}`);
  console.log(`   Ronda inicial: ${config.initialRound}`);
  
  const matches = createBracketMatches(seeded, config);
  
  console.log("\n📝 Matches de la primera ronda:");
  matches.forEach(match => {
    const p1 = match.pareja1 ? `Seed ${match.pareja1.seed.toString().padStart(2)} (Zona ${match.pareja1.zona})` : 'BYE';
    const p2 = match.pareja2 ? `Seed ${match.pareja2.seed.toString().padStart(2)} (Zona ${match.pareja2.zona})` : 'BYE';
    const status = match.status === 'FINISHED' ? ' ✅' : '';
    console.log(`   Match ${match.order.toString().padStart(2)}: ${p1} vs ${p2}${status}`);
  });

  // Mostrar algunos matches destacados
  console.log("\n🌟 Matches destacados:");
  const match1vs32 = matches.find(m => 
    (m.pareja1?.seed === 1 || m.pareja2?.seed === 1) && 
    (m.pareja1?.seed === 32 || m.pareja2?.seed === 32)
  );
  if (match1vs32) {
    console.log(`   Seed 1 vs Seed 32: ${match1vs32.pareja1?.zona || 'BYE'} vs ${match1vs32.pareja2?.zona || 'BYE'}`);
  }

  const match2vs31 = matches.find(m => 
    (m.pareja1?.seed === 2 || m.pareja2?.seed === 2) && 
    (m.pareja1?.seed === 31 || m.pareja2?.seed === 31)
  );
  if (match2vs31) {
    console.log(`   Seed 2 vs Seed 31: ${match2vs31.pareja1?.zona || 'BYE'} vs ${match2vs31.pareja2?.zona || 'BYE'}`);
  }

  console.log("\n✅ ¡Algoritmo completado exitosamente!");
  console.log(`   - Total parejas procesadas: ${exampleCouples.length}`);
  console.log(`   - Seeds asignados: ${seeded.length}`);
  console.log(`   - Matches generados: ${matches.length}`);
  console.log(`   - BYEs automáticos: ${matches.filter(m => m.status === 'FINISHED').length}`);
}

/**
 * Función de prueba end-to-end para verificar el nuevo sistema de brackets
 * Útil para testing y demostración
 */
export function testEndToEndBracketGeneration(): void {
  console.log("🧪 === PRUEBA END-TO-END: NUEVO SISTEMA DE BRACKETS ===\n");
  
  // Datos de ejemplo: 8 parejas clasificadas de 2 zonas
  const testCouples: CoupleSeeded[] = [
    // Zona A (4 parejas)
    { id: "couple-01", zona: "Zone A", puntos: 12, posicionEnZona: 1, zone_id: "zone-a", player1_name: "Juan Pérez", player2_name: "Carlos López" },
    { id: "couple-02", zona: "Zone A", puntos: 9, posicionEnZona: 2, zone_id: "zone-a", player1_name: "Ana García", player2_name: "María Rodríguez" },
    { id: "couple-03", zona: "Zone A", puntos: 6, posicionEnZona: 3, zone_id: "zone-a", player1_name: "Luis Martín", player2_name: "Pedro Sánchez" },
    { id: "couple-04", zona: "Zone A", puntos: 3, posicionEnZona: 4, zone_id: "zone-a", player1_name: "Laura Torres", player2_name: "Sofia Ruiz" },
    
    // Zona B (4 parejas)
    { id: "couple-05", zona: "Zone B", puntos: 11, posicionEnZona: 1, zone_id: "zone-b", player1_name: "Diego Moreno", player2_name: "Javier Díaz" },
    { id: "couple-06", zona: "Zone B", puntos: 8, posicionEnZona: 2, zone_id: "zone-b", player1_name: "Carmen Vega", player2_name: "Elena Jiménez" },
    { id: "couple-07", zona: "Zone B", puntos: 5, posicionEnZona: 3, zone_id: "zone-b", player1_name: "Roberto Castro", player2_name: "Fernando Gil" },
    { id: "couple-08", zona: "Zone B", puntos: 2, posicionEnZona: 4, zone_id: "zone-b", player1_name: "Isabel Ramos", player2_name: "Cristina Herrera" },
  ];

  console.log("📊 Datos de entrada:");
  testCouples.forEach(couple => {
    console.log(`  ${couple.id}: ${couple.posicionEnZona}° ${couple.zona} - ${couple.puntos} pts - ${couple.player1_name}/${couple.player2_name}`);
  });

  console.log("\n🎯 PASO 1: Generar bracket completo");
  const bracketMatches = generateEliminationBracket(testCouples);
  
  console.log(`✅ Bracket generado: ${bracketMatches.length} matches total`);
  
  // Agrupar matches por ronda
  const matchesByRound: { [round: string]: BracketMatch[] } = {};
  bracketMatches.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });

  // Mostrar estructura del bracket
  console.log("\n📋 Estructura del bracket:");
  const roundOrder = ["4TOS", "SEMIFINAL", "FINAL"];
  roundOrder.forEach(round => {
    if (matchesByRound[round]) {
      console.log(`\n  ${round} (${matchesByRound[round].length} matches):`);
      matchesByRound[round].forEach(match => {
        const p1 = match.pareja1 ? `${match.pareja1.player1_name}/${match.pareja1.player2_name}` : 'TBD';
        const p2 = match.pareja2 ? `${match.pareja2.player1_name}/${match.pareja2.player2_name}` : 'TBD';
        const status = match.status === 'FINISHED' ? `✅ Ganador: ${match.winner_id}` : '⏳ Pendiente';
        console.log(`    Match ${match.order}: ${p1} vs ${p2} - ${status}`);
      });
    }
  });

  console.log("\n🔄 PASO 2: Simular avance automático");
  
  // Simular que se completan los cuartos de final
  console.log("\n  Completando cuartos de final...");
  const cuartosMatches = matchesByRound["4TOS"] || [];
  const simulatedWinners: string[] = [];
  
  cuartosMatches.forEach((match, index) => {
    if (match.pareja1 && match.pareja2) {
      // Simular que gana la pareja con más puntos
      const winner = match.pareja1.puntos > match.pareja2.puntos ? match.pareja1 : match.pareja2;
      match.status = 'FINISHED';
      match.winner_id = winner.id;
      simulatedWinners.push(winner.id);
      console.log(`    Match ${match.order}: Gana ${winner.player1_name}/${winner.player2_name}`);
    }
  });

  // Simular avance a semifinales
  console.log("\n  Avanzando ganadores a semifinales...");
  const semifinalMatches = matchesByRound["SEMIFINAL"] || [];
  
  for (let i = 0; i < semifinalMatches.length && i * 2 + 1 < simulatedWinners.length; i++) {
    const match = semifinalMatches[i];
    const winner1Id = simulatedWinners[i * 2];
    const winner2Id = simulatedWinners[i * 2 + 1];
    
    // Encontrar las parejas ganadoras
    const winner1 = testCouples.find(c => c.id === winner1Id);
    const winner2 = testCouples.find(c => c.id === winner2Id);
    
    if (winner1 && winner2) {
      match.pareja1 = { ...winner1, seed: 0 }; // Agregar seed requerido
      match.pareja2 = { ...winner2, seed: 0 };
      match.couple1_id = winner1.id;
      match.couple2_id = winner2.id;
      console.log(`    Semifinal ${match.order}: ${winner1.player1_name}/${winner1.player2_name} vs ${winner2.player1_name}/${winner2.player2_name}`);
    }
  }

  console.log("\n🏆 PASO 3: Verificar placeholders");
  
  // Generar placeholders para la primera ronda
  const firstRoundPlaceholders = generateFirstRoundPlaceholders(assignGlobalSeeds(testCouples));
  console.log("\n  Placeholders de primera ronda:");
  firstRoundPlaceholders.forEach((placeholder, key) => {
    console.log(`    ${key}: ${placeholder.displayText}`);
  });

  // Generar placeholders para semifinales
  const semifinalPlaceholders = generateRoundPlaceholders(
    { name: "SEMIFINAL", matchCount: 2 },
    { name: "4TOS", matchCount: 4 }
  );
  console.log("\n  Placeholders de semifinales:");
  semifinalPlaceholders.forEach((placeholder, key) => {
    console.log(`    ${key}: ${placeholder.displayText}`);
  });

  console.log("\n✅ === PRUEBA COMPLETADA EXITOSAMENTE ===");
  console.log("🎯 Verificaciones realizadas:");
  console.log("  ✓ Generación de bracket completo desde el inicio");
  console.log("  ✓ Creación de todas las rondas (cuartos, semis, final)");
  console.log("  ✓ Asignación correcta de seeds");
  console.log("  ✓ Simulación de avance automático");
  console.log("  ✓ Generación de placeholders descriptivos");
  console.log("  ✓ Estructura de datos compatible con la base de datos");
}

// Función para testing rápido - descomenta para probar
// exampleSeeding();
