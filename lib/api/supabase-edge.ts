import { createClient } from '@/utils/supabase/client'

export async function searchPlayersOrganization(params: {
  searchTerm?: string
  page?: number
  pageSize?: number
  categoryFilter?: string
  organizationId: string
}) {
  const supabase = createClient()

  // Obtener token de sesión
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('[searchPlayersOrganization] Session status:', {
    hasSession: !!session,
    hasToken: !!session?.access_token,
    error: sessionError
  })

  if (!session?.access_token) {
    throw new Error('No autenticado - no hay sesión activa')
  }

  console.log('[searchPlayersOrganization] Calling edge function with params:', params)

  // Llamar a Edge Function con el token de autenticación
  const { data, error } = await supabase.functions.invoke('search-players-organization', {
    body: params,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    console.error('[searchPlayersOrganization] Error calling edge function:', error)
    throw error
  }

  console.log('[searchPlayersOrganization] Success:', { hasData: !!data })

  return data
}

export async function searchRankingPlayers(params: {
  searchTerm?: string
  page?: number
  pageSize?: number
  category?: string | null
  clubId?: string | null
  gender?: 'MALE' | 'FEMALE'
}) {
  const supabase = createClient()

  console.log('[searchRankingPlayers] Calling edge function with params:', params)

  // Llamar a Edge Function (pública, sin autenticación)
  const { data, error } = await supabase.functions.invoke('search-ranking-players', {
    body: params,
  })

  if (error) {
    console.error('[searchRankingPlayers] Error calling edge function:', error)
    throw error
  }

  console.log('[searchRankingPlayers] Success:', { hasData: !!data })

  return data
}

/**
 * 🔍 Buscar jugadores para inscripciones de torneos
 *
 * Edge Function que soporta:
 * - Búsqueda por nombre completo ("Giuliano Politi")
 * - Búsqueda por DNI normalizado ("12345678" encuentra "12.345.678")
 * - Normalización de acentos ("María" = "maria")
 * - Filtrado por género del torneo
 *
 * @param params - Parámetros de búsqueda
 * @param params.searchTerm - Término de búsqueda (nombre, apellido o DNI)
 * @param params.tournamentId - ID del torneo (para filtrar por género)
 * @param params.page - Número de página (default: 1)
 * @param params.pageSize - Tamaño de página (default: 50)
 * @returns Resultados de búsqueda con jugadores, total y paginación
 */
export async function searchTournamentPlayers(params: {
  searchTerm?: string
  tournamentId: string
  page?: number
  pageSize?: number
}) {
  const supabase = createClient()

  console.log('[searchTournamentPlayers] Calling edge function with params:', params)

  // Llamar a Edge Function (pública/autenticada según torneo)
  const { data, error } = await supabase.functions.invoke('search-tournament-players', {
    body: params,
  })

  if (error) {
    console.error('[searchTournamentPlayers] Error calling edge function:', error)
    throw error
  }

  console.log('[searchTournamentPlayers] Success:', { hasData: !!data, playersCount: data?.players?.length })

  return data
}
