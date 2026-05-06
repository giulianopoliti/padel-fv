/**
 * OPTIMISTIC MATCH UPDATE HOOK - UPDATES INTELIGENTES SIN RE-RENDERS
 * 
 * Hook especializado para actualizar matches de forma optimista:
 * - Update inmediato en UI (0ms delay)
 * - Background sync silencioso
 * - Rollback automático en errores
 * - Zero re-renders durante updates
 * - Network request deduplication
 * 
 * @author Claude Code Assistant
 * @version 1.0.0 
 * @created 2025-01-19
 */

'use client'

import React, { useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { useOptimizedBracket } from '../context/optimized-bracket-context'
import type { BracketMatchV2 } from '../types/bracket-types'

// ============================================================================
// TYPES
// ============================================================================

interface MatchResult {
  format: 'single_set' | 'best_of_3'
  sets: Array<{ couple1_games: number; couple2_games: number }>
  winner_id: string
  match_duration_minutes?: number
  notes?: string
  final_score?: string
}

interface OptimisticMatchUpdateConfig {
  /** Tournament ID */
  tournamentId: string
  /** Enable network request deduplication */
  enableDeduplication?: boolean
  /** Timeout for network requests (ms) */
  networkTimeout?: number
  /** Enable rollback on network errors */
  enableRollback?: boolean
  /** Callback for successful updates */
  onUpdateSuccess?: (matchId: string, result: any) => void
  /** Callback for update errors */
  onUpdateError?: (matchId: string, error: any) => void
}

interface OptimisticMatchUpdateResult {
  /** Update match result optimistically */
  updateMatchResult: (matchId: string, result: MatchResult) => Promise<boolean>
  /** Update match status optimistically */  
  updateMatchStatus: (matchId: string, status: string) => Promise<boolean>
  /** Modify existing result optimistically */
  modifyMatchResult: (matchId: string, newResult: MatchResult) => Promise<boolean>
  /** Check if match is currently being updated */
  isUpdating: (matchId: string) => boolean
  /** Get pending updates count */
  pendingUpdatesCount: number
  /** Force sync all pending updates */
  syncPendingUpdates: () => Promise<void>
}

// ============================================================================
// NETWORK REQUEST DEDUPLICATION
// ============================================================================

class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>()
  
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 [RequestDeduplicator] Deduplicating request: ${key}`)
      return this.pendingRequests.get(key)!
    }
    
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key)
    })
    
    this.pendingRequests.set(key, promise)
    return promise
  }
  
  clear() {
    this.pendingRequests.clear()
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useOptimisticMatchUpdate(config: OptimisticMatchUpdateConfig): OptimisticMatchUpdateResult {
  const {
    tournamentId,
    enableDeduplication = true,
    networkTimeout = 10000,
    enableRollback = true,
    onUpdateSuccess,
    onUpdateError
  } = config

  const {
    optimisticUpdateMatch,
    confirmUpdate,
    rollbackUpdate,
    state,
    backgroundSync
  } = useOptimizedBracket()

  // Request deduplicator instance
  const deduplicatorRef = useRef(new RequestDeduplicator())
  const deduplicator = deduplicatorRef.current

  // Track which matches are currently being updated
  const updatingMatches = useRef(new Set<string>())

  // ============================================================================
  // OPTIMISTIC UPDATE MATCH RESULT
  // ============================================================================

  const updateMatchResult = useCallback(async (matchId: string, result: MatchResult): Promise<boolean> => {
    if (updatingMatches.current.has(matchId)) {
      console.log(`⚠️ [useOptimisticMatchUpdate] Match ${matchId} already updating, skipping`)
      return false
    }

    updatingMatches.current.add(matchId)

    try {
      // 1. IMMEDIATE OPTIMISTIC UPDATE (0ms delay)
      const optimisticData: Partial<BracketMatchV2> = {
        status: 'FINISHED' as any,
        result_couple1: result.sets[0].couple1_games > result.sets[0].couple2_games ? 'W' : 'L',
        result_couple2: result.sets[0].couple1_games < result.sets[0].couple2_games ? 'W' : 'L',
        winner_id: result.winner_id,
        final_score: result.final_score || `${result.sets[0].couple1_games}-${result.sets[0].couple2_games}`
      }

      const updateId = optimisticUpdateMatch(matchId, optimisticData)
      
      console.log(`⚡ [useOptimisticMatchUpdate] Optimistic update applied instantly:`, {
        matchId,
        updateId,
        data: optimisticData
      })

      // 2. BACKGROUND NETWORK REQUEST (deduped)
      const networkRequest = async () => {
        const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/update-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result, finishMatch: true }),
          signal: AbortSignal.timeout(networkTimeout)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        return response.json()
      }

      // Execute network request (potentially deduped)
      const requestKey = `update-result-${matchId}`
      const networkPromise = enableDeduplication
        ? deduplicator.deduplicate(requestKey, networkRequest)
        : networkRequest()

      // Handle network response asynchronously  
      networkPromise
        .then((data) => {
          // 3. CONFIRM OPTIMISTIC UPDATE
          console.log(`✅ [useOptimisticMatchUpdate] Network sync successful:`, { matchId, data })
          
          confirmUpdate(updateId, {
            // Add any additional server data if needed
            final_score: data.result?.final_score || optimisticData.final_score
          })
          
          onUpdateSuccess?.(matchId, data)
          
          // Show subtle success feedback
          toast.success('Resultado guardado', { duration: 2000 })
        })
        .catch((error) => {
          // 4. ROLLBACK ON ERROR (if enabled)
          console.error(`❌ [useOptimisticMatchUpdate] Network sync failed:`, { matchId, error })
          
          if (enableRollback) {
            rollbackUpdate(updateId)
          } else {
            confirmUpdate(updateId) // Keep optimistic state even if network failed
          }
          
          onUpdateError?.(matchId, error)
          toast.error(`Error guardando resultado: ${error.message}`)
        })
        .finally(() => {
          updatingMatches.current.delete(matchId)
        })

      // Return true immediately (optimistic success)
      return true

    } catch (error) {
      updatingMatches.current.delete(matchId)
      console.error(`❌ [useOptimisticMatchUpdate] Optimistic update failed:`, error)
      return false
    }
  }, [
    tournamentId, 
    networkTimeout, 
    enableDeduplication, 
    enableRollback,
    optimisticUpdateMatch, 
    confirmUpdate, 
    rollbackUpdate,
    onUpdateSuccess,
    onUpdateError,
    deduplicator
  ])

  // ============================================================================
  // OPTIMISTIC UPDATE MATCH STATUS
  // ============================================================================

  const updateMatchStatus = useCallback(async (matchId: string, status: string): Promise<boolean> => {
    if (updatingMatches.current.has(matchId)) {
      return false
    }

    updatingMatches.current.add(matchId)

    try {
      // Immediate optimistic update
      const optimisticData: Partial<BracketMatchV2> = { status: status as any }
      const updateId = optimisticUpdateMatch(matchId, optimisticData)

      console.log(`⚡ [useOptimisticMatchUpdate] Status update applied:`, { matchId, status })

      // Background network request
      const networkRequest = async () => {
        const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/update-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
          signal: AbortSignal.timeout(networkTimeout)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        return response.json()
      }

      const requestKey = `update-status-${matchId}`
      const networkPromise = enableDeduplication
        ? deduplicator.deduplicate(requestKey, networkRequest)
        : networkRequest()

      networkPromise
        .then((data) => {
          console.log(`✅ [useOptimisticMatchUpdate] Status sync successful:`, { matchId, data })
          confirmUpdate(updateId)
          onUpdateSuccess?.(matchId, data)
        })
        .catch((error) => {
          console.error(`❌ [useOptimisticMatchUpdate] Status sync failed:`, { matchId, error })
          
          if (enableRollback) {
            rollbackUpdate(updateId)
          }
          
          onUpdateError?.(matchId, error)
        })
        .finally(() => {
          updatingMatches.current.delete(matchId)
        })

      return true

    } catch (error) {
      updatingMatches.current.delete(matchId)
      return false
    }
  }, [
    tournamentId,
    networkTimeout,
    enableDeduplication,
    enableRollback,
    optimisticUpdateMatch,
    confirmUpdate,
    rollbackUpdate,
    onUpdateSuccess,
    onUpdateError,
    deduplicator
  ])

  // ============================================================================
  // MODIFY EXISTING RESULT
  // ============================================================================

  const modifyMatchResult = useCallback(async (matchId: string, newResult: MatchResult): Promise<boolean> => {
    // Same logic as updateMatchResult but for modifications
    return updateMatchResult(matchId, newResult)
  }, [updateMatchResult])

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const isUpdating = useCallback((matchId: string): boolean => {
    return updatingMatches.current.has(matchId)
  }, [])

  const pendingUpdatesCount = useMemo(() => {
    return state.optimisticUpdates.filter(update => !update.synced).length
  }, [state.optimisticUpdates])

  const syncPendingUpdates = useCallback(async () => {
    const pendingMatchIds = Array.from(new Set(
      state.optimisticUpdates
        .filter(update => !update.synced)
        .map(update => update.matchId)
    ))
    
    if (pendingMatchIds.length > 0) {
      await backgroundSync(pendingMatchIds)
    }
  }, [state.optimisticUpdates, backgroundSync])

  // ============================================================================
  // CLEANUP
  // ============================================================================

  // Clear deduplicator on unmount
  React.useEffect(() => {
    return () => {
      deduplicator.clear()
      updatingMatches.current.clear()
    }
  }, [deduplicator])

  return {
    updateMatchResult,
    updateMatchStatus,
    modifyMatchResult,
    isUpdating,
    pendingUpdatesCount,
    syncPendingUpdates
  }
}

export default useOptimisticMatchUpdate