/**
 * Hook para validar que todos los partidos de zona estén creados
 * Necesario para habilitar la generación de brackets con placeholders
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-22
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

interface ZoneValidationInfo {
  id: string
  name: string
  couplesCount: number
  matchesCreated: number
  matchesExpected: number
  isComplete: boolean
}

interface ZoneMatchesValidation {
  allCreated: boolean
  zones: ZoneValidationInfo[]
  loading: boolean
}

/**
 * Hook para validar que todos los partidos de zona estén creados
 * según la lógica del formato American 2 (2 partidos por pareja)
 */
export function useZoneMatchesValidation(tournamentId: string) {
  const [validation, setValidation] = useState<ZoneMatchesValidation>({
    allCreated: false,
    zones: [],
    loading: true
  })

  const validateMatches = useCallback(async () => {
    if (!tournamentId) return
    
    setValidation(prev => ({ ...prev, loading: true }))
    
    try {
      const supabase = createClient()
      
      // Obtener zonas del torneo
      const { data: zones, error: zonesError } = await supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', tournamentId)

      if (zonesError) {
        console.error('Error fetching zones:', zonesError)
        return
      }

      const zoneValidations: ZoneValidationInfo[] = []
      let allComplete = true

      for (const zone of zones || []) {
        // Contar parejas en la zona
        const { count: couplesCount, error: coupleError } = await supabase
          .from('zone_positions')
          .select('*', { count: 'exact' })
          .eq('zone_id', zone.id)

        if (coupleError) {
          console.error(`Error counting couples in zone ${zone.name}:`, coupleError)
          continue
        }

        // Contar partidos creados
        const { count: matchesCreated, error: matchError } = await supabase
          .from('matches')
          .select('*', { count: 'exact' })
          .eq('zone_id', zone.id)

        if (matchError) {
          console.error(`Error counting matches in zone ${zone.name}:`, matchError)
          continue
        }

        // Calcular esperados (American 2: 2 partidos por pareja)
        // Zona de 4 parejas = 4 partidos total
        // Zona de 3 parejas = 3 partidos total
        const matchesExpected = (couplesCount || 0) === 4 ? 4 : 3
        const isComplete = (matchesCreated || 0) >= matchesExpected

        if (!isComplete) allComplete = false

        zoneValidations.push({
          id: zone.id,
          name: zone.name,
          couplesCount: couplesCount || 0,
          matchesCreated: matchesCreated || 0,
          matchesExpected,
          isComplete
        })
      }

      setValidation({
        allCreated: allComplete,
        zones: zoneValidations,
        loading: false
      })
    } catch (error) {
      console.error('Error validating zone matches:', error)
      setValidation(prev => ({ ...prev, loading: false }))
    }
  }, [tournamentId])

  useEffect(() => {
    if (tournamentId) {
      validateMatches()
    }
  }, [tournamentId, validateMatches])

  return {
    ...validation,
    refetch: validateMatches
  }
}