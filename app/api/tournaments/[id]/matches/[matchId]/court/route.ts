import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface RouteParams {
  params: Promise<{
    id: string
    matchId: string
  }>
}

/**
 * PATCH /api/tournaments/[id]/matches/[matchId]/court
 *
 * Actualiza la cancha asignada a un partido
 * - CLUB owner, ORGANIZADOR, o ADMIN pueden cambiar canchas
 * - Solo en torneos con estado ZONE_PHASE
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const resolvedParams = await params
  const tournamentId = resolvedParams.id
  const matchId = resolvedParams.matchId

  try {
    const supabase = await createClient()
    const { court } = await request.json()

    // Validar usuario autenticado
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Verificar permisos (CLUB + ORGANIZADOR + ADMIN)
    const permissions = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissions.hasPermission) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para gestionar este torneo' },
        { status: 403 }
      )
    }

    // Obtener status del torneo
    const { data: tournRow, error: tournErr } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .single()

    if (tournErr || !tournRow) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      )
    }

    const { status } = tournRow as { status: string }
    
    // Verificar que el torneo está en ZONE_PHASE
    if (status !== 'ZONE_PHASE') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden cambiar canchas durante la fase de zonas' },
        { status: 400 }
      )
    }
    
    // Verificar que el partido existe
    const { data: matchRow, error: matchErr } = await supabase
      .from('matches')
      .select('id')
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()
      
    if (matchErr || !matchRow) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      )
    }
    
    // Validar número de cancha
    if (!court || court < 1 || court > 10) {
      return NextResponse.json(
        { success: false, error: 'Número de cancha inválido (1-10)' },
        { status: 400 }
      )
    }
    
    // Actualizar la cancha
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({ court })
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .select()
      .single()
      
    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar la cancha: ' + updateError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `Cancha actualizada a ${court}`,
      match: updatedMatch
    })
    
  } catch (error) {
    console.error('Error in PATCH /api/tournaments/[id]/matches/[matchId]/court:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
