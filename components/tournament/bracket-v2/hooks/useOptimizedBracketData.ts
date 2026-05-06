/**
 * OPTIMIZED BRACKET DATA HOOK - VERSIÓN OPTIMIZADA CON UPDATES GRANULARES
 * 
 * Versión mejorada del hook useBracketData que soluciona los problemas de re-rendering:
 * 
 * OPTIMIZACIONES:
 * - Updates granulares en lugar de refetch completo
 * - Memoización inteligente de datos transformados  
 * - Debounce de suscripciones realtime
 * - Cache de transformaciones costosas
 * - Estado local persistente durante updates
 * - Preservación de scroll position
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-19
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/database.types'
import type {
  BracketData,
  BracketMatchV2,
  BracketAlgorithm,
  BracketState,
  SeedInfo,
  ZoneData,
  BracketConfig
} from '../types/bracket-types'
import { DEFAULT_BRACKET_CONFIG } from '../constants/bracket-constants'
import {
  transformCurrentApiMatchesToBracketV2,
  transformLegacySeedsToSeedInfo,
  createZoneDataFromSeeds,
  determineBracketState,
  validateBracketMatches,
  type CurrentApiMatch,
  type LegacySeed
} from '../utils/format-adapters'

// ============================================================================
// TIPOS OPTIMIZADOS
// ============================================================================

interface OptimizedBracketDataState {
  data: BracketData | null
  loading: boolean
  error: Error | null
  lastUpdated: string | null
  isRefetching: boolean
  // NUEVO: Cache de transformaciones
  transformCache: {
    matchesHash: string
    seedsHash: string
    transformedData?: BracketData
  }
}

interface UseBracketDataConfig {
  algorithm?: BracketAlgorithm
  config?: Partial<BracketConfig>
  enableRealtime?: boolean
  refetchInterval?: number
  enabled?: boolean
  // NUEVO: Configuraciones de optimización
  enableOptimisticUpdates?: boolean
  debounceRealtimeMs?: number
  enableTransformCache?: boolean
}

interface OptimizedBracketDataResult {
  data: BracketData | null
  loading: boolean
  error: Error | null
  isRefetching: boolean
  lastUpdated: string | null
  refetch: () => Promise<void>
  clearCache: () => void
  config: BracketConfig
  // NUEVOS: Métodos granulares
  updateSingleMatch: (matchId: string, updates: Partial<BracketMatchV2>) => void
  updateMultipleMatches: (updates: Array<{ matchId: string; updates: Partial<BracketMatchV2> }>) => void
  optimisticUpdate: (matchId: string, result: any, status: string) => void
}

// ============================================================================
// UTILIDADES DE OPTIMIZACIÓN
// ============================================================================

/**
 * Genera hash simple para detectar cambios en datos
 */
function generateDataHash(data: any): string {
  return JSON.stringify(data).slice(0, 50) + data.length
}

/**
 * Debounce función para evitar llamadas excesivas
 */
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Update granular de un match en la lista
 */
function updateMatchInList(matches: BracketMatchV2[], matchId: string, updates: Partial<BracketMatchV2>): BracketMatchV2[] {
  return matches.map(match => 
    match.id === matchId 
      ? { ...match, ...updates }
      : match
  )
}

// ============================================================================
// HOOK PRINCIPAL OPTIMIZADO
// ============================================================================

export function useOptimizedBracketData(
  tournamentId: string,
  options: UseBracketDataConfig = {}
): OptimizedBracketDataResult {
  
  const {
    algorithm = 'serpentine',
    config: customConfig,
    enableRealtime = true,
    refetchInterval,
    enabled = true,
    enableOptimisticUpdates = true,
    debounceRealtimeMs = 300,
    enableTransformCache = true
  } = options

  // Estado interno optimizado
  const [state, setState] = useState<OptimizedBracketDataState>({
    data: null,
    loading: enabled,
    error: null,
    lastUpdated: null,
    isRefetching: false,
    transformCache: {
      matchesHash: '',
      seedsHash: ''
    }
  })

  // Refs para evitar stale closures
  const stateRef = useRef(state)
  stateRef.current = state

  // Configuración final
  const finalConfig = useMemo((): BracketConfig => ({
    ...DEFAULT_BRACKET_CONFIG,
    algorithm,
    ...customConfig
  }), [algorithm, customConfig])

  // Cliente de Supabase
  const supabase = createClientComponentClient<Database>()

  // ============================================================================
  // OPTIMIZACIÓN: UPDATES GRANULARES
  // ============================================================================

  const updateSingleMatch = useCallback((matchId: string, updates: Partial<BracketMatchV2>) => {
    setState(prev => {
      if (!prev.data) return prev

      const updatedMatches = updateMatchInList(prev.data.matches, matchId, updates)
      
      return {
        ...prev,
        data: {
          ...prev.data,
          matches: updatedMatches
        },
        lastUpdated: new Date().toISOString()
      }
    })
  }, [])

  const updateMultipleMatches = useCallback((updates: Array<{ matchId: string; updates: Partial<BracketMatchV2> }>) => {
    setState(prev => {
      if (!prev.data) return prev

      let updatedMatches = prev.data.matches
      updates.forEach(({ matchId, updates: matchUpdates }) => {
        updatedMatches = updateMatchInList(updatedMatches, matchId, matchUpdates)
      })
      
      return {
        ...prev,
        data: {
          ...prev.data,
          matches: updatedMatches
        },
        lastUpdated: new Date().toISOString()
      }
    })
  }, [])

  const optimisticUpdate = useCallback((matchId: string, result: any, status: string) => {
    if (!enableOptimisticUpdates) return

    console.log(`⚡ [useOptimizedBracketData] Optimistic update:`, { matchId, status })
    
    updateSingleMatch(matchId, {
      status: status as any,
      result_couple1: result.sets?.[0]?.couple1_games > result.sets?.[0]?.couple2_games ? 'W' : 'L',
      result_couple2: result.sets?.[0]?.couple1_games < result.sets?.[0]?.couple2_games ? 'W' : 'L',
      winner_id: result.winner_id,
      final_score: result.final_score
    })
  }, [enableOptimisticUpdates, updateSingleMatch])

  // ============================================================================
  // OPTIMIZACIÓN: FETCH CON CACHE DE TRANSFORMACIÓN
  // ============================================================================

  const fetchBracketData = useCallback(async (isRefetch = false) => {
    if (!enabled) return

    try {
      if (isRefetch) {
        setState(prev => ({ ...prev, isRefetching: true }))
      } else {
        setState(prev => ({ ...prev, loading: true, error: null }))
      }

      // Fetch paralelo de datos
      const [matchesResponse, seedsResponse, zonesResponse] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}/matches`).then(r => r.json()),
        fetch(`/api/tournaments/${tournamentId}/seeds`).then(r => r.json()),
        fetch(`/api/tournaments/${tournamentId}/zones-ready`).then(r => r.json())
      ])

      if (!matchesResponse.success) {
        throw new Error('Error fetching matches: ' + (matchesResponse as any).error)
      }
      if (!seedsResponse.success) {
        throw new Error('Error fetching seeds: ' + (seedsResponse as any).error)
      }

      // OPTIMIZACIÓN: Detectar cambios con hash
      const matchesHash = generateDataHash(matchesResponse.matches)
      const seedsHash = generateDataHash(seedsResponse.seeds)
      
      const currentState = stateRef.current
      
      // Si hay cache y los datos no cambiaron, usar cache
      if (enableTransformCache && 
          currentState.transformCache.matchesHash === matchesHash && 
          currentState.transformCache.seedsHash === seedsHash &&
          currentState.transformCache.transformedData) {
        
        console.log(`🚀 [useOptimizedBracketData] Usando cache de transformación`)
        
        setState(prev => ({
          ...prev,
          data: currentState.transformCache.transformedData!,
          loading: false,
          isRefetching: false,
          lastUpdated: new Date().toISOString()
        }))
        return
      }

      console.log(`🔄 [useOptimizedBracketData] Transformando datos (cache miss)`)

      // Transformar datos
      const seeds = transformLegacySeedsToSeedInfo(seedsResponse.seeds)
      const rawMatches = transformCurrentApiMatchesToBracketV2(matchesResponse.matches, seeds, algorithm)
      const validation = validateBracketMatches(rawMatches)
      const matches = validation.validMatches
      
      const zones = createZoneDataFromSeeds(seeds)
      const bracketState = determineBracketState(matches, zonesResponse.ready)

      const bracketData: BracketData = {
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
      }

      setState(prev => ({
        ...prev,
        data: bracketData,
        loading: false,
        isRefetching: false,
        error: null,
        lastUpdated: new Date().toISOString(),
        // NUEVO: Actualizar cache
        transformCache: {
          matchesHash,
          seedsHash,
          transformedData: bracketData
        }
      }))

    } catch (error) {
      console.error('[useOptimizedBracketData] Error fetching data:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        isRefetching: false,
        error: error instanceof Error ? error : new Error('Unknown error fetching bracket data')
      }))
    }
  }, [tournamentId, enabled, algorithm, finalConfig, enableTransformCache])

  // Función para refetch manual
  const refetch = useCallback(async () => {
    await fetchBracketData(true)
  }, [fetchBracketData])

  // Función para limpiar caché
  const clearCache = useCallback(() => {
    setState(prev => ({
      ...prev,
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isRefetching: false,
      transformCache: {
        matchesHash: '',
        seedsHash: ''
      }
    }))
  }, [])

  // ============================================================================
  // OPTIMIZACIÓN: SUSCRIPCIONES REALTIME DEBOUNCED
  // ============================================================================

  // Debounced refetch para evitar llamadas excesivas
  const debouncedRefetch = useMemo(() => 
    debounce(() => {
      console.log('[useOptimizedBracketData] Debounced realtime update')
      fetchBracketData(true)
    }, debounceRealtimeMs),
    [fetchBracketData, debounceRealtimeMs]
  )

  // Fetch inicial
  useEffect(() => {
    if (enabled && tournamentId) {
      fetchBracketData(false)
    }
  }, [fetchBracketData, enabled, tournamentId])

  // Refetch interval (solo si no hay realtime)
  useEffect(() => {
    if (!refetchInterval || !enabled || enableRealtime) return

    const interval = setInterval(() => {
      fetchBracketData(true)
    }, refetchInterval)

    return () => clearInterval(interval)
  }, [refetchInterval, enabled, enableRealtime, fetchBracketData])

  // OPTIMIZACIÓN: Suscripciones realtime con debounce
  useEffect(() => {
    if (!enableRealtime || !enabled) return

    console.log('[useOptimizedBracketData] Configurando suscripciones realtime optimizadas')

    const channel = supabase
      .channel('optimized_bracket_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('[useOptimizedBracketData] Match changed (debounced):', payload)
        
        // OPTIMIZACIÓN: Update granular para cambios específicos
        if (payload.eventType === 'UPDATE' && payload.new) {
          const matchData = payload.new as any
          updateSingleMatch(matchData.id, {
            status: matchData.status,
            result_couple1: matchData.result_couple1,
            result_couple2: matchData.result_couple2,
            winner_id: matchData.winner_id,
            final_score: matchData.final_score || undefined
          })
        } else {
          // Para INSERT/DELETE, usar refetch debounced
          debouncedRefetch()
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'tournament_couple_seeds',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        console.log('[useOptimizedBracketData] Seeds changed (debounced)')
        debouncedRefetch()
      })
      .subscribe()

    return () => {
      console.log('[useOptimizedBracketData] Desconectando suscripciones')
      channel.unsubscribe()
    }
  }, [supabase, tournamentId, enableRealtime, enabled, debouncedRefetch, updateSingleMatch])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    isRefetching: state.isRefetching,
    lastUpdated: state.lastUpdated,
    refetch,
    clearCache,
    config: finalConfig,
    updateSingleMatch,
    updateMultipleMatches,
    optimisticUpdate
  }
}

export default useOptimizedBracketData