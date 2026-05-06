/**
 * SIMPLE BRACKET SYSTEM - SIN RESTRICCIONES
 * 
 * Versión simplificada para testing:
 * - Siempre genera/regenera sin restricciones
 * - Usa placeholders inteligentes por defecto
 * - Permite alternar entre placeholders y datos reales
 * - Sin validaciones complejas de estado
 */

import { createClient } from "@/utils/supabase/server"
import type { Database } from '@/database.types'
import { 
  generateAlternatingBracketSeeding,
  type CoupleFromZone,
  type SeededCouple,
  type BracketPairing 
} from "../test-bracket-seeding/alternating-bracket-algorithm"

// Types simplificados
type MatchStatus = Database["public"]["Enums"]["match_status"]
type RoundType = Database["public"]["Enums"]["ROUND"]

export interface SimpleBracketConfig {
  tournamentId: string
  useRealData?: boolean  // true = usar datos reales, false = solo placeholders
  forceRegenerate?: boolean
}

export interface SimpleBracketResult {
  success: boolean
  message?: string
  matches?: DatabaseMatch[]
  stats: {
    totalMatches: number
    withRealData: number
    withPlaceholders: number
    bracketSize: number
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
 * FUNCIÓN PRINCIPAL: Genera bracket simple sin restricciones
 */
export async function generateSimpleBracket(
  config: SimpleBracketConfig
): Promise<SimpleBracketResult> {
  const { tournamentId, useRealData = false, forceRegenerate = true } = config
  
  console.log(`🎾 [SimpleBracket] Generating bracket - useRealData: ${useRealData}`)

  try {
    // Step 1: Calcular tamaño del bracket basado en inscripciones
    const bracketSize = await calculateBracketSize(tournamentId)
    console.log(`🎾 [SimpleBracket] Bracket size: ${bracketSize}`)

    // Step 2: Obtener parejas (reales o vacías para placeholders)
    const couples = useRealData ? 
      await getRealCouplesFromZones(tournamentId) : 
      []
    
    console.log(`🎾 [SimpleBracket] Couples: ${couples.length} (real data: ${useRealData})`)

    // Step 3: Generar estructura del bracket
    const matches = await generateBracketStructure(
      bracketSize,
      couples,
      tournamentId,
      useRealData
    )

    // Step 4: Guardar en base de datos
    await saveBracketToDatabase(matches, tournamentId)

    // Step 5: Calcular estadísticas
    const stats = {
      totalMatches: matches.length,
      withRealData: matches.filter(m => m.couple1_id !== null && m.couple2_id !== null).length,
      withPlaceholders: matches.filter(m => m.couple1_id === null || m.couple2_id === null).length,
      bracketSize
    }

    const message = useRealData 
      ? `✅ Bracket generado con datos reales: ${stats.withRealData} matches poblados, ${stats.withPlaceholders} placeholders`
      : `✅ Bracket generado con placeholders: ${stats.totalMatches} matches con placeholders inteligentes`

    return {
      success: true,
      message,
      matches,
      stats
    }

  } catch (error) {
    console.error(`🎾 [SimpleBracket] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      stats: { totalMatches: 0, withRealData: 0, withPlaceholders: 0, bracketSize: 0 }
    }
  }
}

/**
 * Calcula el tamaño del bracket basado en inscripciones
 */
async function calculateBracketSize(tournamentId: string): Promise<number> {
  const supabase = await createClient()
  
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('tournament_id', tournamentId)

  const totalCouples = inscriptions?.length || 0
  
  // Siguiente potencia de 2 (mínimo 4)
  return Math.pow(2, Math.ceil(Math.log2(Math.max(4, totalCouples))))
}

/**
 * Obtiene parejas reales de las zonas (si están disponibles)
 */
async function getRealCouplesFromZones(tournamentId: string): Promise<CoupleFromZone[]> {
  const supabase = await createClient()

  try {
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
      console.log(`🎾 [SimpleBracket] No zone data available`)
      return []
    }

    return zonePositions
      .filter(zp => zp.couples && zp.zones)
      .map(zp => ({
        id: zp.couples!.id,
        zoneId: zp.zones!.id,
        zoneName: zp.zones!.name || 'Zone ?',
        zonePosition: zp.position || 1,
        points: zp.total_points || 0,
        player1Name: zp.couples!.player1 ? 
          `${zp.couples!.player1.first_name} ${zp.couples!.player1.last_name}` : 
          'Player 1',
        player2Name: zp.couples!.player2 ? 
          `${zp.couples!.player2.first_name} ${zp.couples!.player2.last_name}` : 
          'Player 2'
      }))

  } catch (error) {
    console.log(`🎾 [SimpleBracket] Error getting real couples:`, error)
    return []
  }
}

/**
 * Genera la estructura completa del bracket
 */
async function generateBracketStructure(
  bracketSize: number,
  couples: CoupleFromZone[],
  tournamentId: string,
  useRealData: boolean
): Promise<DatabaseMatch[]> {
  const matches: DatabaseMatch[] = []
  
  // Calcular todas las rondas
  const rounds = calculateAllRounds(bracketSize)
  console.log(`🎾 [SimpleBracket] Rounds: ${rounds.map(r => r.name).join(' → ')}`)

  // Si tenemos datos reales, usar el algoritmo de seeding
  let bracketPairings: BracketPairing[] = []
  if (useRealData && couples.length > 0) {
    const seedingResult = generateAlternatingBracketSeeding(couples)
    bracketPairings = seedingResult.bracketPairings
    console.log(`🎾 [SimpleBracket] Generated ${bracketPairings.length} real pairings`)
  }

  // Generar todas las rondas
  rounds.forEach((round, roundIndex) => {
    if (roundIndex === 0) {
      // Primera ronda: usar datos reales o placeholders
      const firstRoundMatches = generateFirstRound(
        round, 
        bracketPairings, 
        tournamentId,
        useRealData
      )
      matches.push(...firstRoundMatches)
    } else {
      // Rondas siguientes: siempre placeholders inicialmente
      const laterRoundMatches = generateLaterRound(
        round,
        rounds[roundIndex - 1],
        tournamentId
      )
      matches.push(...laterRoundMatches)
    }
  })

  return matches
}

/**
 * Calcula todas las rondas del bracket
 */
function calculateAllRounds(bracketSize: number) {
  const rounds: Array<{ name: RoundType; matchCount: number }> = []
  let currentSize = bracketSize

  while (currentSize >= 2) {
    const roundName = getRoundName(currentSize)
    const matchCount = currentSize / 2
    
    rounds.push({ name: roundName, matchCount })
    currentSize = currentSize / 2
  }

  return rounds
}

/**
 * Genera la primera ronda con datos reales o placeholders
 */
function generateFirstRound(
  round: { name: RoundType; matchCount: number },
  bracketPairings: BracketPairing[],
  tournamentId: string,
  useRealData: boolean
): DatabaseMatch[] {
  const matches: DatabaseMatch[] = []

  for (let i = 1; i <= round.matchCount; i++) {
    if (useRealData && bracketPairings.length > 0) {
      // Buscar pairing real
      const pairing = bracketPairings.find(p => p.order === i)
      
      if (pairing) {
        matches.push({
          tournament_id: tournamentId,
          couple1_id: pairing.couple1.id,
          couple2_id: pairing.couple2?.id || null,
          round: round.name,
          order: i,
          status: (pairing.couple2 === null ? 'BYE' : 'PENDING') as MatchStatus,
          winner_id: pairing.couple2 === null ? pairing.couple1.id : null,
          type: 'ELIMINATION',
          court: null,
          is_from_initial_generation: true
        })
        continue
      }
    }

    // Crear match con placeholders
    matches.push({
      tournament_id: tournamentId,
      couple1_id: null,
      couple2_id: null,
      round: round.name,
      order: i,
      status: 'WAITING_OPONENT' as MatchStatus,
      winner_id: null,
      type: 'ELIMINATION',
      court: null,
      is_from_initial_generation: true
    })
  }

  return matches
}

/**
 * Genera rondas posteriores (siempre placeholders inicialmente)
 */
function generateLaterRound(
  round: { name: RoundType; matchCount: number },
  previousRound: { name: RoundType; matchCount: number },
  tournamentId: string
): DatabaseMatch[] {
  const matches: DatabaseMatch[] = []

  for (let i = 1; i <= round.matchCount; i++) {
    matches.push({
      tournament_id: tournamentId,
      couple1_id: null,
      couple2_id: null,
      round: round.name,
      order: i,
      status: 'WAITING_OPONENT' as MatchStatus,
      winner_id: null,
      type: 'ELIMINATION',
      court: null,
      is_from_initial_generation: true
    })
  }

  return matches
}

/**
 * Guarda bracket en la base de datos
 */
async function saveBracketToDatabase(
  matches: DatabaseMatch[],
  tournamentId: string
): Promise<void> {
  const supabase = await createClient()

  // Eliminar matches eliminatorios existentes
  await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')

  // Insertar nuevos matches
  const { error } = await supabase
    .from('matches')
    .insert(matches)

  if (error) {
    throw new Error(`Error saving to database: ${error.message}`)
  }

  // Actualizar estado del torneo
  await supabase
    .from('tournaments')
    .update({
      bracket_status: 'BRACKET_GENERATED',
      bracket_generated_at: new Date().toISOString()
    })
    .eq('id', tournamentId)
}

/**
 * Helper: obtiene nombre de ronda
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
 * APIs públicas simplificadas
 */

// Generar bracket solo con placeholders
export async function generatePlaceholderBracket(tournamentId: string): Promise<SimpleBracketResult> {
  return generateSimpleBracket({
    tournamentId,
    useRealData: false,
    forceRegenerate: true
  })
}

// Generar bracket con datos reales
export async function generateRealDataBracket(tournamentId: string): Promise<SimpleBracketResult> {
  return generateSimpleBracket({
    tournamentId,
    useRealData: true,
    forceRegenerate: true
  })
}

// Alternar entre placeholders y datos reales
export async function toggleBracketData(tournamentId: string, useRealData: boolean): Promise<SimpleBracketResult> {
  return generateSimpleBracket({
    tournamentId,
    useRealData,
    forceRegenerate: true
  })
}