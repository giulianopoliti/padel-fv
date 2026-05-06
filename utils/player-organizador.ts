/**
 * 🎯 PLAYER ORGANIZADOR UTILITY
 * 
 * Utilidad para asignar organizador_id a jugadores basado en el torneo.
 * Esta función es conservadora y solo actualiza si el jugador no tiene organizador_id.
 * 
 * Uso: Llamar después de cualquier inscripción para asegurar que el jugador
 * tenga el organizador_id correcto del torneo.
 */

import { createClient } from '@/utils/supabase/server'

/**
 * Resultado de la operación de asignación de organizador
 */
export interface PlayerOrganizadorResult {
  success: boolean
  message: string
  updated?: boolean
  organizador_id?: string | null
  club_id?: string | null
  error?: string
}

/**
 * 🔧 FUNCIÓN PRINCIPAL: Verificar y asignar organizador_id a un jugador
 * 
 * Esta función:
 * 1. Verifica si el jugador ya tiene organizador_id
 * 2. Si no lo tiene, obtiene el organization_id del torneo
 * 3. Actualiza el jugador con el organizador_id
 * 4. Opcionalmente maneja club_id basado en el usuario actual
 * 
 * @param playerId - ID del jugador a verificar/actualizar
 * @param tournamentId - ID del torneo para obtener organization_id
 * @param options - Opciones adicionales
 * @returns Resultado de la operación
 */
export async function checkAndSetPlayerOrganizador(
  playerId: string,
  tournamentId: string,
  options: {
    /** Si debe forzar la actualización aunque ya tenga organizador_id */
    force?: boolean
    /** Si debe también manejar club_id basado en el usuario actual */
    handleClubId?: boolean
    /** Usuario actual para determinar club_id (solo si handleClubId = true) */
    currentUserId?: string
    /** Rol del usuario actual para determinar club_id */
    currentUserRole?: string
  } = {}
): Promise<PlayerOrganizadorResult> {
  const { force = false, handleClubId = false, currentUserId, currentUserRole } = options

  console.log(`[checkAndSetPlayerOrganizador] Iniciando para jugador ${playerId} en torneo ${tournamentId}`, {
    force,
    handleClubId,
    currentUserRole
  })

  try {
    const supabase = await createClient()

    // 1. Obtener información actual del jugador
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, organizador_id, club_id, first_name, last_name')
      .eq('id', playerId)
      .single()

    if (playerError) {
      console.error(`[checkAndSetPlayerOrganizador] Error obteniendo jugador ${playerId}:`, playerError)
      return {
        success: false,
        message: 'Error al obtener información del jugador',
        error: playerError.message
      }
    }

    if (!playerData) {
      console.error(`[checkAndSetPlayerOrganizador] Jugador ${playerId} no encontrado`)
      return {
        success: false,
        message: 'Jugador no encontrado',
        error: 'Player not found'
      }
    }

    // 2. Verificar si ya tiene organizador_id y no forzamos actualización
    if (playerData.organizador_id && !force) {
      console.log(`[checkAndSetPlayerOrganizador] Jugador ${playerId} ya tiene organizador_id: ${playerData.organizador_id}`)
      return {
        success: true,
        message: 'Jugador ya tiene organizador asignado',
        updated: false,
        organizador_id: playerData.organizador_id,
        club_id: playerData.club_id
      }
    }

    // 3. Obtener organization_id del torneo
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, organization_id, name')
      .eq('id', tournamentId)
      .single()

    if (tournamentError) {
      console.error(`[checkAndSetPlayerOrganizador] Error obteniendo torneo ${tournamentId}:`, tournamentError)
      return {
        success: false,
        message: 'Error al obtener información del torneo',
        error: tournamentError.message
      }
    }

    if (!tournamentData || !tournamentData.organization_id) {
      console.warn(`[checkAndSetPlayerOrganizador] Torneo ${tournamentId} no tiene organization_id`)
      return {
        success: true,
        message: 'Torneo no tiene organizador asignado',
        updated: false,
        organizador_id: null,
        club_id: playerData.club_id
      }
    }

    // 4. Preparar datos de actualización
    const updateData: {
      organizador_id: string
      club_id?: string | null
    } = {
      organizador_id: tournamentData.organization_id
    }

    // 5. Manejar club_id si está habilitado
    if (handleClubId && currentUserId && currentUserRole === 'CLUB') {
      // Obtener club_id del usuario actual
      const { data: clubData, error: clubError } = await supabase
        .from('clubes')
        .select('id, name')
        .eq('user_id', currentUserId)
        .single()

      if (clubError) {
        console.warn(`[checkAndSetPlayerOrganizador] No se pudo obtener club del usuario ${currentUserId}:`, clubError)
      } else if (clubData) {
        updateData.club_id = clubData.id
        console.log(`[checkAndSetPlayerOrganizador] Asignando club_id: ${clubData.id} (${clubData.name})`)
      }
    }

    // 6. Actualizar el jugador
    const { error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId)

    if (updateError) {
      console.error(`[checkAndSetPlayerOrganizador] Error actualizando jugador ${playerId}:`, updateError)
      return {
        success: false,
        message: 'Error al actualizar el jugador',
        error: updateError.message
      }
    }

    // 7. Log de éxito
    console.log(`✅ [checkAndSetPlayerOrganizador] Jugador ${playerId} actualizado exitosamente`, {
      player: `${playerData.first_name} ${playerData.last_name}`,
      tournament: tournamentData.name,
      organizador_id: tournamentData.organization_id,
      club_id: updateData.club_id || 'no asignado',
      was_forced: force
    })

    return {
      success: true,
      message: force ? 'Organizador actualizado (forzado)' : 'Organizador asignado correctamente',
      updated: true,
      organizador_id: tournamentData.organization_id,
      club_id: updateData.club_id || playerData.club_id
    }

  } catch (error) {
    console.error(`[checkAndSetPlayerOrganizador] Error inesperado:`, error)
    return {
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 🔧 FUNCIÓN AUXILIAR: Procesar múltiples jugadores en lote
 * 
 * Útil para asignar organizador a múltiples jugadores de una vez
 * 
 * @param playerIds - Array de IDs de jugadores
 * @param tournamentId - ID del torneo
 * @param options - Opciones de procesamiento
 * @returns Resumen de resultados
 */
export async function checkAndSetMultiplePlayersOrganizador(
  playerIds: string[],
  tournamentId: string,
  options: {
    force?: boolean
    handleClubId?: boolean
    currentUserId?: string
    currentUserRole?: string
    /** Si debe continuar procesando aunque alguno falle */
    continueOnError?: boolean
  } = {}
): Promise<{
  success: boolean
  processed: number
  updated: number
  failed: number
  results: PlayerOrganizadorResult[]
}> {
  const { continueOnError = true } = options
  const results: PlayerOrganizadorResult[] = []
  let processed = 0
  let updated = 0
  let failed = 0

  console.log(`[checkAndSetMultiplePlayersOrganizador] Procesando ${playerIds.length} jugadores`)

  for (const playerId of playerIds) {
    try {
      const result = await checkAndSetPlayerOrganizador(playerId, tournamentId, options)
      results.push(result)
      
      processed++
      if (result.updated) updated++
      if (!result.success) failed++

      // Si no debe continuar en errores y falló, romper el loop
      if (!continueOnError && !result.success) {
        console.error(`[checkAndSetMultiplePlayersOrganizador] Deteniendo procesamiento por error en jugador ${playerId}`)
        break
      }

    } catch (error) {
      console.error(`[checkAndSetMultiplePlayersOrganizador] Error procesando jugador ${playerId}:`, error)
      results.push({
        success: false,
        message: 'Error procesando jugador',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      processed++
      failed++

      if (!continueOnError) break
    }
  }

  console.log(`✅ [checkAndSetMultiplePlayersOrganizador] Procesamiento completado: ${processed}/${playerIds.length} procesados, ${updated} actualizados, ${failed} fallos`)

  return {
    success: failed === 0,
    processed,
    updated,
    failed,
    results
  }
}

/**
 * 🔧 FUNCIÓN DE UTILIDAD: Obtener información del organizador de un torneo
 * 
 * @param tournamentId - ID del torneo
 * @returns Información del organizador o null
 */
export async function getTournamentOrganizadorInfo(tournamentId: string) {
  try {
    const supabase = await createClient()
    
    const { data: tournamentData, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        organization_id,
        organizaciones:organization_id (
          id,
          name,
          description
        )
      `)
      .eq('id', tournamentId)
      .single()

    if (error) {
      console.error(`[getTournamentOrganizadorInfo] Error:`, error)
      return null
    }

    return tournamentData
  } catch (error) {
    console.error(`[getTournamentOrganizadorInfo] Error inesperado:`, error)
    return null
  }
}