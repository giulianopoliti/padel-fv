import { createClient } from '@/utils/supabase/server'

export interface ZoneResult {
  success: boolean
  zones?: { id: string }[]
  zoneIds?: string[]
  error?: string
  message?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
  message?: string
}

export interface MatchResult {
  success: boolean
  matches?: { id: string }[]
  matchIds?: string[]
  error?: string
  message?: string
}


/**
 * Obtiene todas las zonas de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<ZoneResult> - Resultado con las zonas o error
 */
export async function getZonesFromTournament(tournamentId: string): Promise<ZoneResult> {
  try {
    const supabase = await createClient()
    
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id')
      .eq('tournament_id', tournamentId)
    
    if (zonesError || !zones) {
      return {
        success: false,
        error: 'Error fetching zones'
      }
    }

    if (zones.length === 0) {
      return {
        success: true,
        message: 'No zones found for this tournament',
        zones: [],
        zoneIds: []
      }
    }

    // Extraer solo los IDs de las zonas
    const zoneIds = zones.map(zone => zone.id)

    return {
      success: true,
      zones,
      zoneIds
    }
  } catch (error) {
    return {
      success: false,
      error: 'Internal server error while fetching zones'
    }
  }
}


/**
 * Elimina todas las zonas y datos relacionados de un torneo
 * @param zoneIds - Array de IDs de zonas a eliminar
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */
export async function deleteZonesAndData(zoneIds: string[]): Promise<DeleteResult> {
  try {
    const supabase = await createClient()

    // Eliminar todas las zone_couples asociadas a estas zonas
    const { error: zcDeleteError } = await supabase
      .from('zone_couples')
      .delete()
      .in('zone_id', zoneIds)
    
    if (zcDeleteError) {
      return {
        success: false,
        error: 'Error deleting zone couples'
      }
    }

    // Eliminar todas las zones_position asociadas a estas zonas
    const { error: zpDeleteError } = await supabase
      .from('zone_positions')
      .delete()
      .in('zone_id', zoneIds)

    if (zpDeleteError) {
      return {
        success: false,
        error: 'Error deleting zones_position'
      }
    }

    // Eliminar las zonas mismas
    const { error: zonesDeleteError } = await supabase
      .from('zones')
      .delete()
      .in('id', zoneIds)

    if (zonesDeleteError) {
      return {
        success: false,
        error: 'Error deleting zones'
      }
    }

    return {
      success: true,
      message: `Successfully deleted ${zoneIds.length} zones and related data`
    }
  } catch (error) {
    return {
      success: false,
      error: 'Internal server error while deleting zones'
    }
  }
}


/**
 * Obtiene todos los matches de bracket (no de zonas) de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<MatchResult> - Resultado con los matches o error
 */
export async function getBracketMatchesFromTournament(tournamentId: string): Promise<MatchResult> {
  try {
    const supabase = await createClient()
    
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .neq('round', 'ZONE')
    
    if (matchesError || !matches) {
      return {
        success: false,
        error: 'Error fetching bracket matches'
      }
    }

    if (matches.length === 0) {
      return {
        success: true,
        message: 'No bracket matches found for this tournament',
        matches: [],
        matchIds: []
      }
    }

    // Extraer solo los IDs de los matches
    const matchIds = matches.map(match => match.id)

    return {
      success: true,
      matches,
      matchIds
    }
  } catch (error) {
    return {
      success: false,
      error: 'Internal server error while fetching bracket matches'
    }
  }
}

/**
 * Elimina el historial de resultados de matches de bracket de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */
export async function deleteMatchResultsHistory(tournamentId: string): Promise<DeleteResult> {
  try {
    console.log('[deleteMatchResultsHistory] Starting deletion for tournament:', tournamentId)
    const supabase = await createClient()
    
    // Primero obtener los IDs de los matches de bracket
    const { data: bracketMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .neq('round', 'ZONE')
    
    if (matchesError) {
      console.error('[deleteMatchResultsHistory] Error fetching bracket matches:', matchesError)
      return {
        success: false,
        error: `Error fetching bracket matches: ${matchesError.message}`
      }
    }

    if (!bracketMatches || bracketMatches.length === 0) {
      console.log('[deleteMatchResultsHistory] No bracket matches found, skipping')
      return {
        success: true,
        message: 'No bracket matches found, nothing to delete'
      }
    }

    const matchIds = bracketMatches.map(m => m.id)
    console.log('[deleteMatchResultsHistory] Found', matchIds.length, 'bracket matches')
    
    // Contar cuántos registros de historial hay
    const { count, error: countError } = await supabase
      .from('match_results_history')
      .select('*', { count: 'exact', head: true })
      .in('match_id', matchIds)
    
    console.log('[deleteMatchResultsHistory] Found history records to delete:', count || 0)
    
    // Eliminar el historial de resultados de esos matches
    const { error: historyError } = await supabase
      .from('match_results_history')
      .delete()
      .in('match_id', matchIds)
    
    if (historyError) {
      console.error('[deleteMatchResultsHistory] Error deleting history:', {
        error: historyError,
        code: historyError.code,
        message: historyError.message,
        details: historyError.details
      })
      return {
        success: false,
        error: `Error deleting match results history: ${historyError.message}`
      }
    }

    console.log('[deleteMatchResultsHistory] Successfully deleted match results history')
    return {
      success: true,
      message: 'Successfully deleted match results history'
    }
  } catch (error) {
    console.error('[deleteMatchResultsHistory] Unexpected error:', error)
    return {
      success: false,
      error: `Internal server error while deleting match results history: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}


/**
 * Elimina todos los matches de bracket (no de zonas) de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */

async function deleteSetMatches(matchesId: string[]): Promise<DeleteResult> {
  try {
    console.log('[deleteSetMatches] Starting deletion for matches:', matchesId.length)
    const supabase = await createClient()

    // Contar cuántos set_matches hay
    const { count, error: countError } = await supabase
      .from('set_matches')
      .select('*', { count: 'exact', head: true })
      .in('match_id', matchesId)

    console.log('[deleteSetMatches] Found set_matches to delete:', count || 0)

    const { error: setMatchesError } = await supabase
      .from('set_matches')
      .delete()
      .in('match_id', matchesId)

    if (setMatchesError) {
      console.error('[deleteSetMatches] Error deleting set_matches:', setMatchesError)
      return {
        success: false,
        error: `Error deleting set_matches: ${setMatchesError.message}`
      }
    }

    console.log('[deleteSetMatches] Successfully deleted set_matches')
    return {
      success: true,
      message: `Successfully deleted ${count || 0} set_matches`
    }
  } catch (error) {
    console.error('[deleteSetMatches] Unexpected error:', error)
    return {
      success: false,
      error: `Internal server error while deleting set_matches: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
export async function deleteBracketMatchesFromTournament(tournamentId: string): Promise<DeleteResult> {
  try {
    console.log(`[deleteBracketMatchesFromTournament] Starting deletion for tournament: ${tournamentId}`)
    const supabase = await createClient()

    // Obtener información del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, type')
      .eq('id', tournamentId)
      .single()

    if (tournamentError) {
      console.error(`[deleteBracketMatchesFromTournament] Error finding tournament:`, tournamentError)
      return {
        success: false,
        error: `Error finding tournament: ${tournamentError.message}`
      }
    }

    // Obtener los IDs de los matches de bracket
    const { data: bracketMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .neq('round', 'ZONE')

    if (matchesError) {
      console.error(`[deleteBracketMatchesFromTournament] Error fetching matches:`, matchesError)
      return {
        success: false,
        error: `Error fetching bracket matches: ${matchesError.message}`
      }
    }

    if (!bracketMatches || bracketMatches.length === 0) {
      console.log(`[deleteBracketMatchesFromTournament] No bracket matches found`)
      return {
        success: true,
        message: 'No bracket matches found to delete'
      }
    }

    const matchIds = bracketMatches.map(m => m.id)
    const matchCount = matchIds.length
    console.log(`[deleteBracketMatchesFromTournament] Found ${matchCount} bracket matches to delete`)

    // Si es torneo LONG, eliminar primero los set_matches
    if (tournament.type === 'LONG') {
      const setMatchesResult = await deleteSetMatches(matchIds)
      if (!setMatchesResult.success) {
        return setMatchesResult
      }
    }

    // Ahora eliminar los matches
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .neq('round', 'ZONE')

    if (deleteError) {
      console.error(`[deleteBracketMatchesFromTournament] Error deleting matches:`, deleteError)
      return {
        success: false,
        error: `Error deleting bracket matches: ${deleteError.message} (Code: ${deleteError.code})`
      }
    }

    console.log(`[deleteBracketMatchesFromTournament] Successfully deleted ${matchCount} bracket matches`)
    return {
      success: true,
      message: `Successfully deleted ${matchCount} bracket matches`
    }
  } catch (error: any) {
    console.error(`[deleteBracketMatchesFromTournament] Unexpected error:`, error)
    return {
      success: false,
      error: `Internal server error while deleting bracket matches: ${error.message}`
    }
  }
}
  

/**
 * Elimina todos los seeds de parejas de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */
export async function deleteCoupleSeeds(tournamentId: string): Promise<DeleteResult> {
  try {
    console.log('[deleteCoupleSeeds] Starting deletion for tournament:', tournamentId)
    const supabase = await createClient()
    
    // Primero contar cuántos seeds hay
    const { count, error: countError } = await supabase
      .from('tournament_couple_seeds')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    
    console.log('[deleteCoupleSeeds] Found seeds to delete:', count || 0)
    
    const { error: seedsError } = await supabase
      .from('tournament_couple_seeds')
      .delete()
      .eq('tournament_id', tournamentId)
    
    if (seedsError) {
      console.error('[deleteCoupleSeeds] Error deleting seeds:', {
        error: seedsError,
        code: seedsError.code,
        message: seedsError.message,
        details: seedsError.details
      })
      return {
        success: false,
        error: `Error deleting couple seeds: ${seedsError.message}`
      }
    }

    console.log('[deleteCoupleSeeds] Successfully deleted couple seeds')
    return {
      success: true,
      message: 'Successfully deleted couple seeds'
    }
  } catch (error) {
    console.error('[deleteCoupleSeeds] Unexpected error:', error)
    return {
      success: false,
      error: `Internal server error while deleting couple seeds: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}


/**
 * Elimina los logs de operaciones de bracket de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */
export async function deleteBracketOperationsLog(tournamentId: string): Promise<DeleteResult> {
  try {
    console.log('[deleteBracketOperationsLog] Starting deletion for tournament:', tournamentId)
    const supabase = await createClient()
    
    // Primero contar cuántos logs hay
    const { count, error: countError } = await supabase
      .from('bracket_operations_log')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    
    console.log('[deleteBracketOperationsLog] Found logs to delete:', count || 0)
    
    const { error: logError } = await supabase
      .from('bracket_operations_log')
      .delete()
      .eq('tournament_id', tournamentId)
    
    if (logError) {
      console.error('[deleteBracketOperationsLog] Error deleting logs:', {
        error: logError,
        code: logError.code,
        message: logError.message,
        details: logError.details
      })
      return {
        success: false,
        error: `Error deleting bracket operations log: ${logError.message}`
      }
    }

    console.log('[deleteBracketOperationsLog] Successfully deleted bracket operations log')
    return {
      success: true,
      message: 'Successfully deleted bracket operations log'
    }
  } catch (error) {
    console.error('[deleteBracketOperationsLog] Unexpected error:', error)
    return {
      success: false,
      error: `Internal server error while deleting bracket operations log: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}


/**
 * Elimina la jerarquía de matches de un torneo específico
 * @param tournamentId - ID del torneo
 * @returns Promise<DeleteResult> - Resultado de la operación
 */
export async function deleteMatchesHierarchy(tournamentId: string): Promise<DeleteResult> {
  try {
    console.log('[deleteMatchesHierarchy] Starting deletion for tournament:', tournamentId)
    const supabase = await createClient()
    
    // Primero contar cuántas relaciones hay
    const { count, error: countError } = await supabase
      .from('match_hierarchy')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    
    console.log('[deleteMatchesHierarchy] Found hierarchy relations to delete:', count || 0)
    
    const { error: mHierarchyError } = await supabase
      .from('match_hierarchy')
      .delete()
      .eq('tournament_id', tournamentId)
    
    if (mHierarchyError) {
      console.error('[deleteMatchesHierarchy] Error deleting hierarchy:', {
        error: mHierarchyError,
        code: mHierarchyError.code,
        message: mHierarchyError.message,
        details: mHierarchyError.details
      })
      return {
        success: false,
        error: `Error deleting match hierarchy: ${mHierarchyError.message}`
      }
    }

    console.log('[deleteMatchesHierarchy] Successfully deleted match hierarchy')
    return {
      success: true,
      message: 'Successfully deleted match hierarchy'
    }
  } catch (error) {
    console.error('[deleteMatchesHierarchy] Unexpected error:', error)
    return {
      success: false,
      error: `Internal server error while deleting match hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}