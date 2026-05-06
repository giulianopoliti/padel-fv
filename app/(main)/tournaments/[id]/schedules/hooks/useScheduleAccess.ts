import { useState, useEffect, useCallback } from 'react'
import { UserAccess, ActionResult } from '../types'
import { checkUserAccess } from '../actions'

interface UseScheduleAccessState {
  userAccess: UserAccess | null
  loading: boolean
  error: string | null
}

export function useScheduleAccess(tournamentId: string) {
  const [state, setState] = useState<UseScheduleAccessState>({
    userAccess: null,
    loading: true,
    error: null
  })

  const checkAccess = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await checkUserAccess(tournamentId)
      
      if (result.success && result.data) {
        setState({
          userAccess: result.data,
          loading: false,
          error: null
        })
      } else {
        setState({
          userAccess: null,
          loading: false,
          error: result.error || 'Error desconocido'
        })
      }
    } catch (error) {
      setState({
        userAccess: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      })
    }
  }, [tournamentId])

  const retry = useCallback(() => {
    checkAccess()
  }, [checkAccess])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  return {
    ...state,
    retry
  }
}