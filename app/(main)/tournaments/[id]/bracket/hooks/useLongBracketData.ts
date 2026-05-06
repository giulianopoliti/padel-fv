'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBracketData } from '@/components/tournament/bracket-v2/hooks/useBracketData'
import { getMatchSchedulingData, type SchedulingData } from '../../match-scheduling/actions'
import { getTimeSlotsForRound, getFechasByRoundType, type TournamentFecha } from '../../dates/actions'

/**
 * Hook especializado para torneos largos que combina:
 * - Datos del bracket (useBracketData)
 * - Datos de scheduling (disponibilidad, time slots)
 * - Filtros por ronda
 * - Estados de carga optimizados
 */

interface UseLongBracketDataConfig {
  /** Ronda seleccionada para filtrar */
  selectedRound?: string
  /** Round type para scheduling (NUEVO: basado en round_type) */
  selectedRoundType?: 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL'
  /** Fecha seleccionada para scheduling (LEGACY: para compatibilidad) */
  selectedFechaId?: string
  /** Si debe cargar datos de scheduling */
  includeSchedulingData?: boolean
}

interface UseLongBracketDataResult {
  // Datos del bracket (from useBracketData)
  bracketData: any
  bracketLoading: boolean
  bracketError: Error | null

  // Datos de scheduling (LEGACY: for specific fecha)
  schedulingData: SchedulingData | null
  schedulingLoading: boolean
  schedulingError: string | null

  // Datos de round-based scheduling (NUEVO)
  roundFechas: TournamentFecha[]
  roundTimeSlots: any[]
  roundAvailability: any[]
  roundSchedulingLoading: boolean
  roundSchedulingError: string | null

  // Estados combinados
  isLoading: boolean
  hasError: boolean

  // Acciones
  refetchBracket: () => Promise<void>
  refetchScheduling: () => Promise<void>
  refetchRoundScheduling: () => Promise<void>
  refetchAll: () => Promise<void>
}

export function useLongBracketData(
  tournamentId: string,
  config: UseLongBracketDataConfig = {}
): UseLongBracketDataResult {

  const {
    selectedRound,
    selectedRoundType,
    selectedFechaId,
    includeSchedulingData = false
  } = config

  // Hook del bracket base
  const {
    data: bracketData,
    loading: bracketLoading,
    error: bracketError,
    refetch: refetchBracket
  } = useBracketData(tournamentId, {
    algorithm: 'serpentine',
    enableRealtime: false,
    enabled: true
  })

  // Estado para datos de scheduling (LEGACY)
  const [schedulingState, setSchedulingState] = useState<{
    data: SchedulingData | null
    loading: boolean
    error: string | null
  }>({
    data: null,
    loading: false,
    error: null
  })

  // Estado para round-based scheduling (NUEVO)
  const [roundSchedulingState, setRoundSchedulingState] = useState<{
    fechas: TournamentFecha[]
    timeSlots: any[]
    availability: any[]
    loading: boolean
    error: string | null
  }>({
    fechas: [],
    timeSlots: [],
    availability: [],
    loading: false,
    error: null
  })

  // Función para cargar datos de scheduling
  const fetchSchedulingData = useCallback(async (fechaId: string) => {
    if (!includeSchedulingData || !fechaId || fechaId === 'current') {
      console.log('🚫 [useLongBracketData] Skipping scheduling data fetch:', {
        includeSchedulingData,
        fechaId,
        reason: !includeSchedulingData ? 'disabled' : !fechaId ? 'no fechaId' : 'invalid fechaId'
      })
      return
    }

    console.log('📊 [useLongBracketData] Fetching scheduling data for fecha:', fechaId)
    setSchedulingState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await getMatchSchedulingData(tournamentId, fechaId)

      if (result.success && result.data) {
        setSchedulingState({
          data: result.data,
          loading: false,
          error: null
        })
        console.log('✅ [useLongBracketData] Scheduling data loaded successfully')
      } else {
        setSchedulingState({
          data: null,
          loading: false,
          error: result.error || 'Error al cargar datos de scheduling'
        })
        console.error('❌ [useLongBracketData] Scheduling data error:', result.error)
      }
    } catch (err) {
      setSchedulingState({
        data: null,
        loading: false,
        error: 'Error inesperado al cargar datos de scheduling'
      })
      console.error('❌ [useLongBracketData] Error loading scheduling data:', err)
    }
  }, [tournamentId, includeSchedulingData])

  // Función para cargar datos de round-based scheduling (NUEVO)
  const fetchRoundSchedulingData = useCallback(async (roundType: 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL') => {
    if (!roundType) {
      console.log('🚫 [useLongBracketData] Skipping round scheduling data fetch: no roundType')
      return
    }

    console.log('📊 [useLongBracketData] Fetching round scheduling data for:', roundType, 'tournament:', tournamentId)
    setRoundSchedulingState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Fetch fechas, time slots, and availability in parallel
      const [fechasResult, timeSlotsResult] = await Promise.all([
        getFechasByRoundType(tournamentId, roundType),
        getTimeSlotsForRound(tournamentId, roundType)
      ])

      if (fechasResult.success && timeSlotsResult.success) {
        // Now fetch availability data for the time slots
        let availabilityData: any[] = []

        if (timeSlotsResult.data && timeSlotsResult.data.length > 0) {
          const timeSlotIds = timeSlotsResult.data.map((slot: any) => slot.id)

          try {
            const { createClient } = await import('@/utils/supabase/client')
            const supabase = createClient()

            const { data: availability, error: availabilityError } = await supabase
              .from('couple_time_availability')
              .select('*')
              .in('time_slot_id', timeSlotIds)

            if (availabilityError) {
              console.warn('⚠️ [useLongBracketData] Failed to load availability:', availabilityError)
            } else {
              availabilityData = availability || []
              console.log('✅ [useLongBracketData] Availability data loaded:', availabilityData.length, 'entries')
            }
          } catch (availError) {
            console.warn('⚠️ [useLongBracketData] Error loading availability:', availError)
          }
        }

        setRoundSchedulingState({
          fechas: fechasResult.data || [],
          timeSlots: timeSlotsResult.data || [],
          availability: availabilityData,
          loading: false,
          error: null
        })
        console.log('✅ [useLongBracketData] Round scheduling data loaded successfully:', {
          fechas: fechasResult.data?.length || 0,
          timeSlots: timeSlotsResult.data?.length || 0,
          availability: availabilityData.length
        })
      } else {
        const error = fechasResult.error || timeSlotsResult.error || 'Error al cargar datos de la ronda'
        setRoundSchedulingState({
          fechas: [],
          timeSlots: [],
          availability: [],
          loading: false,
          error
        })
        console.error('❌ [useLongBracketData] Round scheduling data error:', {
          fechasError: fechasResult.error,
          timeSlotsError: timeSlotsResult.error,
          fechasSuccess: fechasResult.success,
          timeSlotsSuccess: timeSlotsResult.success
        })
      }
    } catch (err) {
      setRoundSchedulingState({
        fechas: [],
        timeSlots: [],
        availability: [],
        loading: false,
        error: 'Error inesperado al cargar datos de la ronda'
      })
      console.error('❌ [useLongBracketData] Error loading round scheduling data:', err instanceof Error ? err.message : String(err))
    }
  }, [tournamentId])

  // Cargar datos de scheduling cuando cambie la fecha (LEGACY)
  useEffect(() => {
    if (selectedFechaId && includeSchedulingData) {
      fetchSchedulingData(selectedFechaId)
    }
  }, [selectedFechaId, includeSchedulingData, fetchSchedulingData])

  // Cargar datos de round-based scheduling cuando cambie el round type (NUEVO)
  useEffect(() => {
    if (selectedRoundType) {
      fetchRoundSchedulingData(selectedRoundType)
    }
  }, [selectedRoundType, fetchRoundSchedulingData])

  // Función para refetch de scheduling (LEGACY)
  const refetchScheduling = useCallback(async () => {
    if (selectedFechaId) {
      await fetchSchedulingData(selectedFechaId)
    }
  }, [selectedFechaId, fetchSchedulingData])

  // Función para refetch de round scheduling (NUEVO)
  const refetchRoundScheduling = useCallback(async () => {
    if (selectedRoundType) {
      await fetchRoundSchedulingData(selectedRoundType)
    }
  }, [selectedRoundType, fetchRoundSchedulingData])

  // Función para refetch de todo
  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchBracket(),
      refetchScheduling(),
      refetchRoundScheduling()
    ])
  }, [refetchBracket, refetchScheduling, refetchRoundScheduling])

  // Estados combinados
  const isLoading = bracketLoading || schedulingState.loading || roundSchedulingState.loading
  const hasError = !!bracketError || !!schedulingState.error || !!roundSchedulingState.error

  return {
    // Datos del bracket
    bracketData,
    bracketLoading,
    bracketError,

    // Datos de scheduling (LEGACY)
    schedulingData: schedulingState.data,
    schedulingLoading: schedulingState.loading,
    schedulingError: schedulingState.error,

    // Datos de round-based scheduling (NUEVO)
    roundFechas: roundSchedulingState.fechas,
    roundTimeSlots: roundSchedulingState.timeSlots,
    roundAvailability: roundSchedulingState.availability,
    roundSchedulingLoading: roundSchedulingState.loading,
    roundSchedulingError: roundSchedulingState.error,

    // Estados combinados
    isLoading,
    hasError,

    // Acciones
    refetchBracket,
    refetchScheduling,
    refetchRoundScheduling,
    refetchAll
  }
}