/**
 * HOOK DE DATOS DEL BRACKET V2
 * 
 * Hook especializado para obtener y transformar datos del bracket.
 * Convierte APIs existentes al formato BracketMatchV2.
 * 
 * FUNCIONALIDADES:
 * - Obtiene matches del torneo
 * - Obtiene seeds (tournament_couple_seeds)
 * - Verifica estado de zonas
 * - Transforma al formato BracketMatchV2
 * - Maneja caché y refetch
 * - Suscripciones en tiempo real
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import useSWR from 'swr'
import type { Database } from '@/database.types'
import type {
  BracketData,
  BracketMatchV2,
  BracketAlgorithm,
  BracketState,
  SeedInfo,
  ZoneData,
  BracketConfig,
  BracketApiResponse
} from '../types/bracket-types'
import { DEFAULT_BRACKET_CONFIG } from '../constants/bracket-constants'
import {
  transformCurrentApiMatchesToBracketV2,
  transformLegacyMatchesToBracketV2,
  transformLegacySeedsToSeedInfo,
  createZoneDataFromSeeds,
  determineBracketState,
  validateBracketMatches,
  createTransformationDebugInfo,
  type CurrentApiMatch,
  type LegacyMatch,
  type LegacySeed
} from '../utils/format-adapters'

// ============================================================================
// TIPOS DE RESPUESTA DE APIs EXISTENTES
// ============================================================================

/**
 * Respuesta del endpoint /api/tournaments/[id]/matches (estructura actual)
 */
interface CurrentMatchesResponse {
  success: boolean
  matches: CurrentApiMatch[]
}

/**
 * Respuesta del endpoint /api/tournaments/[id]/matches (legacy)
 */
interface LegacyMatchesResponse {
  success: boolean
  matches: LegacyMatch[]
}

/**
 * Respuesta del endpoint /api/tournaments/[id]/seeds
 */
interface LegacySeedsResponse {
  success: boolean
  seeds: LegacySeed[]
  count: number
}

/**
 * Respuesta del endpoint /api/tournaments/[id]/zones-ready
 */
interface ZonesReadyResponse {
  ready: boolean
  message: string
  totalCouples: number
  zonesCount: number
  debug?: boolean
}

// ============================================================================
// ESTADO DEL HOOK
// ============================================================================

/**
 * Estado interno del hook
 */
interface BracketDataState {
  /** Datos del bracket */
  data: BracketData | null
  /** Si está cargando */
  loading: boolean
  /** Error si existe */
  error: Error | null
  /** Timestamp de última actualización */
  lastUpdated: string | null
  /** Estado de refetch */
  isRefetching: boolean
}

/**
 * Configuración del hook
 */
interface UseBracketDataConfig {
  /** Algoritmo a usar */
  algorithm?: BracketAlgorithm
  /** Configuración personalizada */
  config?: Partial<BracketConfig>
  /** Habilitar suscripciones en tiempo real */
  enableRealtime?: boolean
  /** Intervalo de refetch automático (ms) */
  refetchInterval?: number
  /** Si debe hacer fetch inicial */
  enabled?: boolean
}

/**
 * Valor de retorno del hook
 */
interface UseBracketDataResult {
  /** Datos del bracket */
  data: BracketData | null
  /** Si está cargando inicialmente */
  loading: boolean
  /** Error si existe */
  error: Error | null
  /** Si está refetching */
  isRefetching: boolean
  /** Timestamp de última actualización */
  lastUpdated: string | null
  /** Función para refetch manual */
  refetch: () => Promise<void>
  /** Función para limpiar caché */
  clearCache: () => void
  /** Configuración final usada */
  config: BracketConfig
}

// ============================================================================
// FUNCIONES DE VALIDACIÓN Y PROCESAMIENTO
// ============================================================================

/**
 * Procesa y valida matches transformados
 */
function processTransformedMatches(
  matches: BracketMatchV2[],
  tournamentId: string
): BracketMatchV2[] {
  // Validar matches
  const validation = validateBracketMatches(matches)
  
  if (!validation.valid) {
    console.warn(`[useBracketData] ${validation.errors.length} matches with validation errors:`, validation.errors)
  }
  
  // Log de debug en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log(`[useBracketData] Processed ${validation.validMatches.length} valid matches for tournament ${tournamentId}`)
  }
  
  return validation.validMatches
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook principal para obtener datos del bracket
 */
export function useBracketData(
  tournamentId: string,
  options: UseBracketDataConfig = {}
): UseBracketDataResult {

  const {
    algorithm = 'serpentine',
    config: customConfig,
    enableRealtime = true,
    refetchInterval,
    enabled = true
  } = options

  // Configuración final
  const finalConfig = useMemo((): BracketConfig => ({
    ...DEFAULT_BRACKET_CONFIG,
    algorithm,
    ...customConfig
  }), [algorithm, customConfig])

  // Cliente de Supabase
  const supabase = createClientComponentClient<Database>()

  // SWR keys para cache management
  const swrKeys = useMemo(() => ({
    matches: enabled ? `/api/tournaments/${tournamentId}/matches` : null,
    seeds: enabled ? `/api/tournaments/${tournamentId}/seeds` : null,
    zones: enabled ? `/api/tournaments/${tournamentId}/zones-ready` : null
  }), [tournamentId, enabled])

  // Fetcher function que SWR usará
  const fetcher = useCallback(async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }, [])

  // ✅ USAR SWR HOOKS PARALELOS para cada endpoint
  const {
    data: matchesData,
    error: matchesError,
    mutate: mutateMatches,
    isValidating: matchesValidating
  } = useSWR(swrKeys.matches, fetcher, {
    refreshInterval: refetchInterval,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000, // Dedupe requests for 2 seconds
    onSuccess: (data) => {
      console.log('🔄 [useBracketData] MATCHES SWR onSuccess triggered:', {
        key: swrKeys.matches,
        matchesCount: data?.matches?.length || 0
      })
    },
    onError: (error) => {
      console.error('❌ [useBracketData] MATCHES SWR onError:', error)
    }
  })

  const {
    data: seedsData,
    error: seedsError,
    mutate: mutateSeeds,
    isValidating: seedsValidating
  } = useSWR(swrKeys.seeds, fetcher, {
    refreshInterval: refetchInterval,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  })

  const {
    data: zonesData,
    error: zonesError,
    mutate: mutateZones,
    isValidating: zonesValidating
  } = useSWR(swrKeys.zones, fetcher, {
    refreshInterval: refetchInterval,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  })

  // Estados derivados
  const loading = !matchesData || !seedsData || !zonesData
  const isRefetching = matchesValidating || seedsValidating || zonesValidating
  const error = matchesError || seedsError || zonesError

  // ✅ PROCESAR DATOS CUANDO ESTÁN DISPONIBLES
  const bracketData = useMemo(() => {
    if (!matchesData?.success || !seedsData?.success || !zonesData) {
      return null
    }

    try {
      // DEBUG: Log de matches desde API
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [useBracketData] Matches desde API (SWR):`, {
          tournamentId,
          totalMatches: matchesData.matches.length,
          roundCounts: matchesData.matches.reduce((acc: Record<string, number>, match: any) => {
            acc[match.round] = (acc[match.round] || 0) + 1
            return acc
          }, {}),
          matchIdsSample: matchesData.matches.slice(0, 5).map((m: any) => ({ id: m.id, round: m.round }))
        })
      }

      // Transformar datos usando los adaptadores
      const seeds = transformLegacySeedsToSeedInfo(seedsData.seeds)
      const rawMatches = transformCurrentApiMatchesToBracketV2(matchesData.matches, seeds, algorithm)
      const matches = processTransformedMatches(rawMatches, tournamentId)

      // DEBUG: Log de matches después de transformación
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 [useBracketData] Matches después de transformación (SWR):`, {
          totalMatches: matches.length,
          roundCounts: matches.reduce((acc: Record<string, number>, match) => {
            acc[match.round] = (acc[match.round] || 0) + 1
            return acc
          }, {})
        })
      }

      // Crear zones data desde seeds
      const zones = createZoneDataFromSeeds(seeds)

      // Determinar estado del bracket
      const bracketState = determineBracketState(matches, zonesData.ready)

      // Debug info en desarrollo
      if (process.env.NODE_ENV === 'development') {
        const debugInfo = createTransformationDebugInfo(matchesData.matches as any, matches, seeds)
        console.log('[useBracketData] Transformation debug (SWR):', debugInfo)
      }

      // Crear datos finales
      return {
        matches,
        seeds,
        zones,
        config: finalConfig,
        state: bracketState,
        algorithmInfo: {
          algorithm,
          guarantee: algorithm === 'serpentine' ? '1A vs 1B solo en final' : undefined,
          description: algorithm === 'serpentine' ? 'Algoritmo serpenteo avanzado' : 'Algoritmo tradicional'
        }
      } as BracketData

    } catch (processError) {
      console.error('[useBracketData] Error processing data:', processError)
      return null
    }
  }, [matchesData, seedsData, zonesData, algorithm, finalConfig, tournamentId])

  // ✅ SOLUCION 2: Función de refetch centralizada que invalida todos los SWR caches
  const refetch = useCallback(async () => {
    console.log('🔄 [useBracketData] Manual refetch triggered - invalidating all SWR caches')
    console.log('🔄 [useBracketData] Current SWR keys:', swrKeys)

    // Invalidar todos los caches SWR en paralelo
    const results = await Promise.allSettled([
      mutateMatches(),
      mutateSeeds(),
      mutateZones()
    ])

    results.forEach((result, index) => {
      const cacheNames = ['matches', 'seeds', 'zones']
      if (result.status === 'fulfilled') {
        console.log(`✅ [useBracketData] ${cacheNames[index]} cache refetch successful`)
      } else {
        console.error(`❌ [useBracketData] ${cacheNames[index]} cache refetch failed:`, result.reason)
      }
    })
  }, [mutateMatches, mutateSeeds, mutateZones, swrKeys])

  // ✅ SOLUCION 3: Función para limpiar caché SWR
  const clearCache = useCallback(() => {
    console.log('🗑️ [useBracketData] Clearing SWR caches')
    mutateMatches(undefined, false) // Clear cache without revalidation
    mutateSeeds(undefined, false)
    mutateZones(undefined, false)
  }, [mutateMatches, mutateSeeds, mutateZones])

  // ✅ SOLUCION 4: Suscripciones en tiempo real mejoradas
  useEffect(() => {
    if (!enableRealtime || !enabled) return

    console.log('🔴 [useBracketData] Setting up realtime subscriptions with SWR invalidation')

    const channel = supabase
      .channel('bracket_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('🔴 [useBracketData] Matches changed via realtime, invalidating SWR:', payload)
        mutateMatches() // SWR invalidation
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_couple_seeds',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('🔴 [useBracketData] Seeds changed via realtime, invalidating SWR:', payload)
        mutateSeeds() // SWR invalidation
      })
      // ✅ NUEVO: Escuchar también cambios en set_matches para torneos largos
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'set_matches',
        filter: `match_id=in.(${matchesData?.matches?.map((m: any) => m.id).join(',') || ''})`
      }, (payload) => {
        console.log('🔴 [useBracketData] Set matches changed via realtime, invalidating matches SWR:', payload)
        mutateMatches() // SWR invalidation
      })
      .subscribe()

    return () => {
      console.log('🔴 [useBracketData] Cleaning up realtime subscriptions')
      channel.unsubscribe()
    }
  }, [supabase, tournamentId, enableRealtime, enabled, mutateMatches, mutateSeeds, matchesData?.matches])

  return {
    data: bracketData,
    loading,
    error: error ? (error instanceof Error ? error : new Error('Unknown SWR error')) : null,
    isRefetching,
    lastUpdated: bracketData ? new Date().toISOString() : null,
    refetch,
    clearCache,
    config: finalConfig
  }
}

export default useBracketData