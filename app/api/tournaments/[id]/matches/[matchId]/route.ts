import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createApiResponse } from '@/utils/serialization'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface RouteParams {
  params: {
    id: string
    matchId: string
  }
}

/**
 * DELETE /api/tournaments/[id]/matches/[matchId]
 * 
 * Borra un partido del torneo con las siguientes características:
 * - Solo en torneos con estado ZONE_PHASE
 * - Solo el owner del torneo puede borrar
 * - Permite borrar partidos CON resultado asignado
 * - Recalcula automáticamente las posiciones de zona si el partido tenía resultado
 * - Usa la misma función checkAndUpdateZonePositions que saveMatchResult
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const tournamentId = params.id
  const matchId = params.matchId
  
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el torneo existe y obtener su estado
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, status, club_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Torneo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el torneo está en ZONE_PHASE
    if (tournament.status !== 'ZONE_PHASE') {
      return NextResponse.json(
        {
          success: false,
          error: `Solo se pueden borrar partidos en la fase de zonas. Estado actual: ${tournament.status}`
        },
        { status: 400 }
      )
    }

    // Verificar permisos usando la función centralizada
    const permissions = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissions.hasPermission) {
      return NextResponse.json(
        { success: false, error: permissions.reason || 'No tienes permisos para borrar partidos' },
        { status: 403 }
      )
    }

    // Verificar que el partido existe y obtener sus datos
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        tournament_id,
        zone_id,
        status,
        result_couple1,
        result_couple2,
        winner_id,
        couple1_id,
        couple2_id
      `)
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { success: false, error: 'Partido no encontrado' },
        { status: 404 }
      )
    }

    // Guardar si el partido tenía resultado para recalcular posiciones después
    const hadResult = match.result_couple1 !== null || match.result_couple2 !== null || match.winner_id !== null

    // Borrar el partido
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)

    if (deleteError) {
      console.error('[DELETE match] Error al borrar partido:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Error al borrar el partido' },
        { status: 500 }
      )
    }

    // Si el partido tenía resultado y zona, recalcular posiciones (igual que saveMatchResult)
    if (hadResult && match.zone_id) {
      try {
        // Importar la función de manera dinámica como en saveMatchResult
        const { checkAndUpdateZonePositions } = await import('../../actions')
        const positionUpdate = await checkAndUpdateZonePositions(tournamentId, match.zone_id)
        
        return NextResponse.json(createApiResponse({
          success: true,
          message: 'Partido borrado exitosamente',
          hadResult,
          positionUpdate: {
            positionsUpdated: positionUpdate.positionsUpdated,
            bracketAdvanced: positionUpdate.bracketAdvanced,
            placeholdersResolved: positionUpdate.placeholdersResolved,
            message: positionUpdate.message
          }
        }))
      } catch (error) {
        console.error('Error updating positions after match deletion:', error)
        // Return success even if position update fails (igual que saveMatchResult)
        return NextResponse.json(createApiResponse({
          success: true,
          message: 'Partido borrado exitosamente (error recalculando posiciones)',
          hadResult
        }))
      }
    }

    return NextResponse.json(createApiResponse({
      success: true,
      message: 'Partido borrado exitosamente',
      hadResult
    }))

  } catch (error) {
    console.error('[DELETE match] Error inesperado:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
