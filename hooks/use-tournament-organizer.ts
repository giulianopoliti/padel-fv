/**
 * 🏢 HOOK: useTournamentOrganizer
 *
 * Hook personalizado para obtener información del organizador de un torneo.
 * Usado principalmente en el flujo de consentimiento para jugadores.
 */

import { useState, useEffect } from 'react'
import { getTournamentOrganizadorInfo } from '@/utils/player-organizador'

export interface TournamentOrganizer {
  id: string
  name: string
  description?: string
}

export interface TournamentOrganizerData {
  tournamentId: string
  tournamentName: string
  organizador: TournamentOrganizer | null
}

export interface UseTournamentOrganizerReturn {
  organizadorData: TournamentOrganizerData | null
  organizador: TournamentOrganizer | null
  isLoading: boolean
  error: string | null
  hasOrganizador: boolean
  refetch: () => Promise<void>
}

/**
 * Hook para obtener información del organizador de un torneo
 *
 * @param tournamentId - ID del torneo
 * @returns Información del organizador y estado de carga
 */
export function useTournamentOrganizer(tournamentId: string): UseTournamentOrganizerReturn {
  const [organizadorData, setOrganizadorData] = useState<TournamentOrganizerData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizadorData = async () => {
    if (!tournamentId) {
      setError('ID de torneo requerido')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`[useTournamentOrganizer] Obteniendo info del organizador para torneo: ${tournamentId}`)

      const tournamentInfo = await getTournamentOrganizadorInfo(tournamentId)

      if (!tournamentInfo) {
        setError('No se pudo obtener información del torneo')
        setOrganizadorData(null)
        return
      }

      // Extraer información del organizador
      const organizador = tournamentInfo.organizaciones ? {
        id: tournamentInfo.organizaciones.id,
        name: tournamentInfo.organizaciones.name,
        description: tournamentInfo.organizaciones.description
      } : null

      const data: TournamentOrganizerData = {
        tournamentId: tournamentInfo.id,
        tournamentName: tournamentInfo.name,
        organizador
      }

      setOrganizadorData(data)

      console.log(`✅ [useTournamentOrganizer] Organizador obtenido:`, {
        tournament: data.tournamentName,
        organizador: organizador?.name || 'Sin organizador'
      })

    } catch (err) {
      console.error('[useTournamentOrganizer] Error obteniendo organizador:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setOrganizadorData(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Efecto para cargar datos cuando cambia el tournamentId
  useEffect(() => {
    if (tournamentId) {
      fetchOrganizadorData()
    } else {
      setOrganizadorData(null)
      setError(null)
    }
  }, [tournamentId])

  return {
    organizadorData,
    organizador: organizadorData?.organizador || null,
    isLoading,
    error,
    hasOrganizador: !!organizadorData?.organizador,
    refetch: fetchOrganizadorData
  }
}

/**
 * Hook simplificado que solo retorna si el torneo tiene organizador
 *
 * @param tournamentId - ID del torneo
 * @returns Boolean indicando si tiene organizador
 */
export function useTournamentHasOrganizer(tournamentId: string): {
  hasOrganizador: boolean
  isLoading: boolean
} {
  const { hasOrganizador, isLoading } = useTournamentOrganizer(tournamentId)

  return {
    hasOrganizador,
    isLoading
  }
}