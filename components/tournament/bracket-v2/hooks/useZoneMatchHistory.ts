/**
 * USE ZONE MATCH HISTORY HOOK
 *
 * Hook que detecta si dos parejas ya se enfrentaron en la fase de zonas.
 * Útil para alertar al usuario sobre posibles duplicados en el bracket de eliminación.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-XX
 */

'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Información de un enfrentamiento histórico en zonas
 */
interface ZoneMatchInfo {
  matchId: string
  couple1Id: string
  couple2Id: string
  zoneName?: string
  finishedAt?: string
}

/**
 * Resultado del hook
 */
interface ZoneMatchHistoryResult {
  /** Map de couple_id → Set de opponent_couple_ids que ya enfrentó */
  history: Map<string, Set<string>>
  /** Lista completa de enfrentamientos históricos */
  matches: ZoneMatchInfo[]
  /** Si está cargando */
  isLoading: boolean
  /** Error si ocurrió */
  error: Error | null
}

/**
 * Match raw de Supabase
 */
interface ZoneMatchRaw {
  id: string
  couple1_id: string | null
  couple2_id: string | null
  tournament_couple_seed1_id: string | null
  tournament_couple_seed2_id: string | null
  status: string
  zone_id: string | null
  created_at: string
}

/**
 * Seed data de Supabase
 */
interface TournamentCoupleSeedRaw {
  id: string
  couple_id: string | null
  seed: number
}

// ============================================================================
// FETCHER
// ============================================================================

/**
 * Fetcher que obtiene todos los matches de zona finalizados
 * y resuelve los seeds a couple_ids
 */
const fetchZoneMatchHistory = async (tournamentId: string): Promise<ZoneMatchHistoryResult> => {
  const supabase = createClient()

  // PASO 1: Obtener matches de zonas finalizados
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      couple1_id,
      couple2_id,
      tournament_couple_seed1_id,
      tournament_couple_seed2_id,
      status,
      zone_id,
      created_at
    `)
    .eq('tournament_id', tournamentId)
    .eq('round', 'ZONE')
    .eq('status', 'FINISHED')

  if (matchesError) {
    console.error('❌ [useZoneMatchHistory] Error fetching matches:', matchesError)
    throw matchesError
  }

  if (!matches || matches.length === 0) {
    // No hay matches de zona finalizados
    return {
      history: new Map(),
      matches: [],
      isLoading: false,
      error: null
    }
  }

  // PASO 2: Extraer todos los seed IDs únicos que necesitamos resolver
  const seedIds = new Set<string>()
  matches.forEach((match: ZoneMatchRaw) => {
    if (match.tournament_couple_seed1_id) {
      seedIds.add(match.tournament_couple_seed1_id)
    }
    if (match.tournament_couple_seed2_id) {
      seedIds.add(match.tournament_couple_seed2_id)
    }
  })

  // PASO 3: Resolver seeds a couple_ids (solo si hay seeds)
  let seedToCoupleMap = new Map<string, string>()

  if (seedIds.size > 0) {
    const { data: seeds, error: seedsError } = await supabase
      .from('tournament_couple_seeds')
      .select('id, couple_id, seed')
      .in('id', Array.from(seedIds))

    if (seedsError) {
      console.error('❌ [useZoneMatchHistory] Error fetching seeds:', seedsError)
      // No lanzamos error, simplemente continuamos sin resolver seeds
    } else if (seeds) {
      seeds.forEach((seed: TournamentCoupleSeedRaw) => {
        if (seed.couple_id) {
          seedToCoupleMap.set(seed.id, seed.couple_id)
        }
      })
    }
  }

  // PASO 4: Procesar matches y construir historial
  const history = new Map<string, Set<string>>()
  const processedMatches: ZoneMatchInfo[] = []

  matches.forEach((match: ZoneMatchRaw) => {
    // Resolver couple IDs (directo o via seed)
    const couple1Id = match.couple1_id ||
      (match.tournament_couple_seed1_id ? seedToCoupleMap.get(match.tournament_couple_seed1_id) : null)

    const couple2Id = match.couple2_id ||
      (match.tournament_couple_seed2_id ? seedToCoupleMap.get(match.tournament_couple_seed2_id) : null)

    // Solo procesar si ambas parejas están definidas
    if (couple1Id && couple2Id) {
      // Agregar al historial (bidireccional)
      if (!history.has(couple1Id)) {
        history.set(couple1Id, new Set())
      }
      history.get(couple1Id)!.add(couple2Id)

      if (!history.has(couple2Id)) {
        history.set(couple2Id, new Set())
      }
      history.get(couple2Id)!.add(couple1Id)

      // Agregar a lista de matches procesados
      processedMatches.push({
        matchId: match.id,
        couple1Id,
        couple2Id,
        finishedAt: match.created_at
      })
    }
  })

  console.log('✅ [useZoneMatchHistory] Historial construido:', {
    totalMatches: processedMatches.length,
    totalCouples: history.size,
    tournamentId
  })

  return {
    history,
    matches: processedMatches,
    isLoading: false,
    error: null
  }
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook que retorna el historial de enfrentamientos en zonas
 *
 * @param tournamentId - ID del torneo
 * @returns Objeto con historial, matches, loading y error
 *
 * @example
 * ```tsx
 * const { history, isLoading } = useZoneMatchHistory(tournamentId)
 *
 * // Verificar si dos parejas ya jugaron
 * const playedBefore = history.has(couple1Id) &&
 *   history.get(couple1Id)?.has(couple2Id)
 * ```
 */
export function useZoneMatchHistory(tournamentId: string): ZoneMatchHistoryResult {
  const supabase = createClient()

  // SWR con key única por torneo
  const { data, error, isLoading } = useSWR(
    tournamentId ? `zone-match-history-${tournamentId}` : null,
    () => fetchZoneMatchHistory(tournamentId),
    {
      revalidateOnFocus: false, // No revalidar en focus (datos históricos)
      revalidateOnReconnect: false, // No revalidar en reconnect
      dedupingInterval: 60000, // Dedup por 1 minuto
    }
  )

  // Resultado default si no hay data
  const defaultResult: ZoneMatchHistoryResult = {
    history: new Map(),
    matches: [],
    isLoading: true,
    error: null
  }

  if (isLoading) {
    return { ...defaultResult, isLoading: true }
  }

  if (error) {
    return { ...defaultResult, isLoading: false, error }
  }

  return data || defaultResult
}

// ============================================================================
// HELPERS EXPORTADOS
// ============================================================================

/**
 * Verifica si dos parejas ya se enfrentaron en zonas
 *
 * @param history - Map de historial de enfrentamientos
 * @param couple1Id - ID de la primera pareja
 * @param couple2Id - ID de la segunda pareja
 * @returns true si ya jugaron, false si no
 */
export function havePlayedInZone(
  history: Map<string, Set<string>>,
  couple1Id: string | null,
  couple2Id: string | null
): boolean {
  if (!couple1Id || !couple2Id) return false

  return (history.has(couple1Id) && history.get(couple1Id)!.has(couple2Id)) ||
         (history.has(couple2Id) && history.get(couple2Id)!.has(couple1Id))
}
