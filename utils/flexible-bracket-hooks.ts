/**
 * FLEXIBLE BRACKET HOOKS
 * 
 * React hooks for managing flexible bracket state and operations
 * in tournament components.
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  BracketState, 
  BracketStateInfo, 
  analyzeBracketState,
  validateBracketAction 
} from './bracket-state-manager'

export interface FlexibleBracketHookReturn {
  // State
  bracketState: BracketState | null
  stateInfo: BracketStateInfo | null
  needsRegeneration: boolean
  isLoading: boolean
  error: string | null
  
  // Actions  
  generateBracket: () => Promise<boolean>
  regenerateBracket: (force?: boolean) => Promise<boolean>
  checkRegeneration: () => Promise<void>
  validateAddCouple: () => Promise<{ allowed: boolean; warning?: string }>
  
  // Utilities
  canAddCouples: boolean
  canRegenerate: boolean
  requiresConfirmation: boolean
}

/**
 * Main hook for flexible bracket management
 */
export function useFlexibleBracket(tournamentId: string): FlexibleBracketHookReturn {
  const [bracketState, setBracketState] = useState<BracketState | null>(null)
  const [stateInfo, setStateInfo] = useState<BracketStateInfo | null>(null)
  const [needsRegeneration, setNeedsRegeneration] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load bracket state
  const loadBracketState = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket?action=state`)
      const result = await response.json()
      
      if (result.success) {
        setBracketState(result.state.state)
        setStateInfo(result.state)
      } else {
        setError(result.error || 'Error loading bracket state')
      }
    } catch (err) {
      console.error('[useFlexibleBracket] Error loading state:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [tournamentId])

  // Check if regeneration is needed
  const checkRegeneration = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket?action=check-regeneration`)
      const result = await response.json()
      
      if (result.success) {
        setNeedsRegeneration(result.regenerationCheck.needsRegeneration)
      }
    } catch (err) {
      console.error('[useFlexibleBracket] Error checking regeneration:', err)
    }
  }, [tournamentId])

  // Generate bracket
  const generateBracket = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadBracketState()
        await checkRegeneration()
        return true
      } else {
        setError(result.error || 'Error generating bracket')
        return false
      }
    } catch (err) {
      console.error('[useFlexibleBracket] Error generating bracket:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [tournamentId, loadBracketState, checkRegeneration])

  // Regenerate bracket
  const regenerateBracket = useCallback(async (force = false): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'regenerate',
          force,
          preservePlayedMatches: !force
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadBracketState()
        await checkRegeneration()
        return true
      } else {
        setError(result.error || 'Error regenerating bracket')
        return false
      }
    } catch (err) {
      console.error('[useFlexibleBracket] Error regenerating bracket:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [tournamentId, loadBracketState, checkRegeneration])

  // Validate adding a couple
  const validateAddCouple = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-add-couple' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        return {
          allowed: result.validation.allowed,
          warning: result.validation.warning
        }
      } else {
        return {
          allowed: false,
          warning: result.error || 'Validation failed'
        }
      }
    } catch (err) {
      console.error('[useFlexibleBracket] Error validating add couple:', err)
      return {
        allowed: false,
        warning: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }, [tournamentId])

  // Load initial state
  useEffect(() => {
    loadBracketState()
    checkRegeneration()
  }, [loadBracketState, checkRegeneration])

  // Computed properties
  const canAddCouples = stateInfo?.canAddCouples ?? false
  const canRegenerate = stateInfo?.canRegenerate ?? false
  const requiresConfirmation = stateInfo?.requiresConfirmation ?? false

  return {
    // State
    bracketState,
    stateInfo,
    needsRegeneration,
    isLoading,
    error,
    
    // Actions
    generateBracket,
    regenerateBracket,
    checkRegeneration,
    validateAddCouple,
    
    // Utilities
    canAddCouples,
    canRegenerate,
    requiresConfirmation
  }
}

/**
 * Simplified hook for bracket state monitoring
 */
export function useBracketState(tournamentId: string) {
  const [state, setState] = useState<BracketState | null>(null)
  const [needsRegeneration, setNeedsRegeneration] = useState(false)
  
  useEffect(() => {
    const checkState = async () => {
      try {
        const [stateResponse, regenResponse] = await Promise.all([
          fetch(`/api/tournaments/${tournamentId}/flexible-bracket?action=state`),
          fetch(`/api/tournaments/${tournamentId}/flexible-bracket?action=check-regeneration`)
        ])
        
        const [stateResult, regenResult] = await Promise.all([
          stateResponse.json(),
          regenResponse.json()
        ])
        
        if (stateResult.success) {
          setState(stateResult.state.state)
        }
        
        if (regenResult.success) {
          setNeedsRegeneration(regenResult.regenerationCheck.needsRegeneration)
        }
      } catch (error) {
        console.error('Error checking bracket state:', error)
      }
    }
    
    checkState()
    
    // Poll every 30 seconds for changes
    const interval = setInterval(checkState, 30000)
    return () => clearInterval(interval)
  }, [tournamentId])
  
  return { state, needsRegeneration }
}

/**
 * Hook for bracket regeneration with confirmation handling
 */
export function useBracketRegeneration(tournamentId: string) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  
  const regenerateWithConfirmation = useCallback(async (
    onConfirm?: (message: string) => Promise<boolean>,
    onSuccess?: (message: string) => void,
    onError?: (error: string) => void
  ) => {
    try {
      setIsRegenerating(true)
      
      // First, try without force
      const response = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' })
      })
      
      const result = await response.json()
      
      if (result.success) {
        onSuccess?.(result.message || 'Bracket regenerated successfully')
        return true
      } else if (result.requiresConfirmation && onConfirm) {
        // Ask for confirmation
        const confirmed = await onConfirm(result.error || 'This action requires confirmation')
        
        if (confirmed) {
          // Regenerate with force
          const forceResponse = await fetch(`/api/tournaments/${tournamentId}/flexible-bracket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'regenerate', force: true })
          })
          
          const forceResult = await forceResponse.json()
          
          if (forceResult.success) {
            onSuccess?.(forceResult.message || 'Bracket regenerated successfully')
            return true
          } else {
            onError?.(forceResult.error || 'Error during forced regeneration')
            return false
          }
        }
      } else {
        onError?.(result.error || 'Regeneration failed')
        return false
      }
    } catch (error) {
      console.error('Error in regeneration:', error)
      onError?.(error instanceof Error ? error.message : 'Unknown error')
      return false
    } finally {
      setIsRegenerating(false)
    }
  }, [tournamentId])
  
  return { isRegenerating, regenerateWithConfirmation }
}