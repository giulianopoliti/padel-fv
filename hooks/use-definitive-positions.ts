/**
 * DEFINITIVE POSITIONS HOOK
 * 
 * Hook de React para manejar análisis de posiciones definitivas
 * desde componentes de UI. Integra con el sistema optimizado y
 * proporciona estado reactivo para la interfaz.
 * 
 * FEATURES:
 * - Estado reactivo con SWR
 * - Análisis on-demand
 * - Cache inteligente
 * - Loading states
 * - Error handling
 * - Real-time updates
 */

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { DefinitivePositionTriggerService } from '@/lib/services/definitive-position-trigger-service'
import type { 
  ZoneAnalysisResult, 
  OptimizedPositionAnalysis 
} from '@/lib/services/optimized-definitive-analyzer'
import type { TriggerResult } from '@/lib/services/definitive-position-trigger-service'

// ============================================================================
// TYPES
// ============================================================================

export interface DefinitivePositionsState {
  // Data
  tournamentId: string
  totalCouples: number
  definitivePositions: number
  nonDefinitivePositions: number
  zonesResults: ZoneAnalysisResult[]
  lastAnalysisTime?: string
  
  // Status
  isLoading: boolean
  isAnalyzing: boolean
  isUpdating: boolean
  error: string | null
  
  // Performance metrics
  analysisTimeMs: number
  optimizationsUsed: number
  cacheHits: number
}

export interface DefinitivePositionsActions {
  // Analysis actions
  runAnalysis: (options?: AnalysisOptions) => Promise<TriggerResult>
  refreshData: () => Promise<void>
  
  // Zone-specific actions
  analyzeZone: (zoneId: string) => Promise<TriggerResult>
  
  // Bracket generation
  triggerBracketGeneration: () => Promise<TriggerResult>
  
  // Utilities
  isPositionDefinitive: (zoneId: string, coupleId: string) => boolean | null
  getPositionAnalysis: (zoneId: string, coupleId: string) => OptimizedPositionAnalysis | null
  getZoneProgress: (zoneId: string) => { definitive: number; total: number } | null
}

export interface AnalysisOptions {
  zones?: string[]
  updateDatabase?: boolean
  useCache?: boolean
  maxTimeMs?: number
  force?: boolean
}

export interface UseDefinitivePositionsConfig {
  tournamentId: string
  enableRealTimeUpdates?: boolean
  refreshInterval?: number
  autoAnalyzeOnMount?: boolean
  cacheTime?: number
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useDefinitivePositions(
  config: UseDefinitivePositionsConfig
): DefinitivePositionsState & DefinitivePositionsActions {
  
  const {
    tournamentId,
    enableRealTimeUpdates = true,
    refreshInterval = 30000, // 30 seconds
    autoAnalyzeOnMount = false,
    cacheTime = 5 * 60 * 1000 // 5 minutes
  } = config
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggerService] = useState(() => new DefinitivePositionTriggerService())
  
  // ============================================================================
  // SWR DATA FETCHING
  // ============================================================================
  
  const fetcher = useCallback(async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }, [])
  
  const swrKey = `/api/tournaments/${tournamentId}/optimized-definitive-analysis`
  
  const {
    data: analysisData,
    error: swrError,
    mutate,
    isLoading: swrLoading
  } = useSWR(
    tournamentId ? swrKey : null,
    fetcher,
    {
      refreshInterval: enableRealTimeUpdates ? refreshInterval : 0,
      dedupingInterval: cacheTime,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 3,
      errorRetryInterval: 2000
    }
  )
  
  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================
  
  useEffect(() => {
    if (!enableRealTimeUpdates || !tournamentId) return
    
    const supabase = createClient()
    
    // Subscribe to zone_positions changes
    const subscription = supabase
      .channel(`definitive-positions-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zone_positions',
          filter: `zone_id=in.(select id from zones where tournament_id=eq.${tournamentId})`
        },
        (payload) => {
          console.log('🔄 [DEFINITIVE-HOOK] Zone positions changed:', payload)
          // Invalidate cache and refetch
          mutate()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `zone_id=in.(select id from zones where tournament_id=eq.${tournamentId})`
        },
        (payload) => {
          console.log('🔄 [DEFINITIVE-HOOK] Match status changed:', payload)
          // Trigger analysis if match completed
          if (payload.new && (payload.new as any).status === 'COMPLETED') {
            const matchId = (payload.new as any).id
            const zoneId = (payload.new as any).zone_id
            triggerService.triggerMatchCompleted(matchId, tournamentId, zoneId)
          }
          // Refresh data
          mutate()
        }
      )
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [enableRealTimeUpdates, tournamentId, mutate, triggerService])
  
  // ============================================================================
  // AUTO ANALYSIS ON MOUNT
  // ============================================================================
  
  useEffect(() => {
    if (autoAnalyzeOnMount && tournamentId && !swrLoading && !analysisData?.zones_results?.length) {
      console.log('🚀 [DEFINITIVE-HOOK] Auto-analyzing on mount')
      runAnalysis({ useCache: true })
    }
  }, [autoAnalyzeOnMount, tournamentId, swrLoading, analysisData])
  
  // ============================================================================
  // ACTIONS
  // ============================================================================
  
  const runAnalysis = useCallback(async (options: AnalysisOptions = {}): Promise<TriggerResult> => {
    setIsAnalyzing(true)
    setError(null)
    
    try {
      console.log('🔍 [DEFINITIVE-HOOK] Running analysis with options:', options)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/optimized-definitive-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zones: options.zones,
          update_db: options.updateDatabase ?? true,
          use_cache: options.useCache ?? true,
          max_time_ms: options.maxTimeMs ?? 5000,
          dry_run: false
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed')
      }
      
      console.log('✅ [DEFINITIVE-HOOK] Analysis complete:', result)
      
      // Refresh SWR data
      await mutate()
      
      const triggerResult: TriggerResult = {
        success: true,
        event: {
          type: 'MANUAL_REFRESH',
          tournament_id: tournamentId,
          timestamp: new Date().toISOString()
        },
        analysis_results: result.zones_results,
        processing_time_ms: result.analysis_time_ms,
        updates_applied: result.updates_applied || 0
      }
      
      return triggerResult
      
    } catch (err: any) {
      const error = err.message || 'Unknown analysis error'
      console.error('❌ [DEFINITIVE-HOOK] Analysis error:', error)
      setError(error)
      
      return {
        success: false,
        event: {
          type: 'MANUAL_REFRESH',
          tournament_id: tournamentId,
          timestamp: new Date().toISOString()
        },
        processing_time_ms: 0,
        updates_applied: 0,
        error
      }
    } finally {
      setIsAnalyzing(false)
    }
  }, [tournamentId, mutate])
  
  const refreshData = useCallback(async (): Promise<void> => {
    setIsUpdating(true)
    try {
      await mutate()
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data')
    } finally {
      setIsUpdating(false)
    }
  }, [mutate])
  
  const analyzeZone = useCallback(async (zoneId: string): Promise<TriggerResult> => {
    return runAnalysis({ zones: [zoneId] })
  }, [runAnalysis])
  
  const triggerBracketGeneration = useCallback(async (): Promise<TriggerResult> => {
    console.log('🎯 [DEFINITIVE-HOOK] Triggering bracket generation')
    return triggerService.triggerBracketGeneration(tournamentId)
  }, [triggerService, tournamentId])
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const isPositionDefinitive = useCallback((zoneId: string, coupleId: string): boolean | null => {
    if (!analysisData?.zones_results) return null
    
    const zone = analysisData.zones_results.find((z: ZoneAnalysisResult) => z.zoneId === zoneId)
    if (!zone) return null
    
    const analysis = zone.positionAnalyses.find((a: OptimizedPositionAnalysis) => a.coupleId === coupleId)
    return analysis ? analysis.isDefinitive : null
  }, [analysisData])
  
  const getPositionAnalysis = useCallback((zoneId: string, coupleId: string): OptimizedPositionAnalysis | null => {
    if (!analysisData?.zones_results) return null
    
    const zone = analysisData.zones_results.find((z: ZoneAnalysisResult) => z.zoneId === zoneId)
    if (!zone) return null
    
    return zone.positionAnalyses.find((a: OptimizedPositionAnalysis) => a.coupleId === coupleId) || null
  }, [analysisData])
  
  const getZoneProgress = useCallback((zoneId: string): { definitive: number; total: number } | null => {
    if (!analysisData?.zones_results) return null
    
    const zone = analysisData.zones_results.find((z: ZoneAnalysisResult) => z.zoneId === zoneId)
    if (!zone) return null
    
    return {
      definitive: zone.definitivePositions,
      total: zone.totalCouples
    }
  }, [analysisData])
  
  // ============================================================================
  // COMPUTED STATE
  // ============================================================================
  
  const state: DefinitivePositionsState = {
    // Data
    tournamentId,
    totalCouples: analysisData?.total_couples || 0,
    definitivePositions: analysisData?.definitive_positions || 0,
    nonDefinitivePositions: analysisData?.non_definitive_positions || 0,
    zonesResults: analysisData?.zones_results || [],
    lastAnalysisTime: analysisData?.last_analysis_time,
    
    // Status
    isLoading: swrLoading,
    isAnalyzing,
    isUpdating,
    error: error || (swrError?.message),
    
    // Performance
    analysisTimeMs: analysisData?.analysis_time_ms || 0,
    optimizationsUsed: analysisData?.performance_metrics?.total_optimizations || 0,
    cacheHits: analysisData?.performance_metrics?.cache_hits || 0
  }
  
  const actions: DefinitivePositionsActions = {
    runAnalysis,
    refreshData,
    analyzeZone,
    triggerBracketGeneration,
    isPositionDefinitive,
    getPositionAnalysis,
    getZoneProgress
  }
  
  return {
    ...state,
    ...actions
  }
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook simplificado para verificar si posiciones son definitivas
 */
export function useIsPositionDefinitive(
  tournamentId: string,
  zoneId: string,
  coupleId: string
): boolean | null {
  const { isPositionDefinitive } = useDefinitivePositions({ tournamentId })
  return isPositionDefinitive(zoneId, coupleId)
}

/**
 * Hook para obtener progreso de una zona específica
 */
export function useZoneDefinitiveProgress(
  tournamentId: string,
  zoneId: string
): { definitive: number; total: number; percentage: number } | null {
  const { getZoneProgress } = useDefinitivePositions({ tournamentId })
  const progress = getZoneProgress(zoneId)
  
  if (!progress) return null
  
  return {
    ...progress,
    percentage: progress.total > 0 ? Math.round((progress.definitive / progress.total) * 100) : 0
  }
}

/**
 * Hook para análisis masivo de torneo
 */
export function useTournamentDefinitiveAnalysis(tournamentId: string) {
  const analysis = useDefinitivePositions({
    tournamentId,
    enableRealTimeUpdates: true,
    autoAnalyzeOnMount: true
  })
  
  const canGenerateBrackets = analysis.definitivePositions > 0
  const isReadyForBrackets = analysis.definitivePositions === analysis.totalCouples
  const progressPercentage = analysis.totalCouples > 0 
    ? Math.round((analysis.definitivePositions / analysis.totalCouples) * 100) 
    : 0
  
  return {
    ...analysis,
    canGenerateBrackets,
    isReadyForBrackets,
    progressPercentage
  }
}