import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface AssignCourtRequest {
  court: string
  startMatch?: boolean  // Si true, cambia el estado a IN_PROGRESS
}

interface AssignCourtResponse {
  success: boolean
  matchId: string
  court: string
  status: string
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
): Promise<NextResponse<AssignCourtResponse>> {
  try {
    const tournamentId = params.id
    const matchId = params.matchId
    const body: AssignCourtRequest = await request.json()
    
    const { court, startMatch = false } = body

    // Validar que el court está presente
    if (!court || court.trim() === '') {
      return NextResponse.json({
        success: false,
        matchId,
        court: '',
        status: '',
        error: 'Court is required'
      }, { status: 400 })
    }

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Verificar autenticación y permisos (owner)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        matchId,
        court: '',
        status: '',
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Verificar permisos usando la función centralizada
    const permissionResult = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionResult.hasPermission) {
      return NextResponse.json({
        success: false,
        matchId,
        court: '',
        status: '',
        error: permissionResult.reason || 'Insufficient permissions'
      }, { status: 403 })
    }

    // Obtener el match actual
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, court, couple1_id, couple2_id, round, order_in_round')
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({
        success: false,
        matchId,
        court: '',
        status: '',
        error: 'Match not found'
      }, { status: 404 })
    }

    // Validar que el match puede ser asignado a cancha
    if (match.status === 'FINISHED') {
      return NextResponse.json({
        success: false,
        matchId,
        court: match.court || '',
        status: match.status,
        error: 'Cannot assign court to finished match'
      }, { status: 400 })
    }

    // Validar que el match tiene ambas parejas (para empezar)
    if (startMatch && (!match.couple1_id || !match.couple2_id)) {
      return NextResponse.json({
        success: false,
        matchId,
        court: match.court || '',
        status: match.status,
        error: 'Cannot start match without both couples assigned'
      }, { status: 400 })
    }

    // Determinar nuevo estado
    const newStatus = startMatch ? 'IN_PROGRESS' : 'PENDING'
    const previousStatus = match.status

    // Actualizar match
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        court: court.trim(),
        status: newStatus
      })
      .eq('id', matchId)

    if (updateError) {
      console.error('Failed to assign court:', updateError)
      return NextResponse.json({
        success: false,
        matchId,
        court: '',
        status: '',
        error: 'Failed to assign court'
      }, { status: 500 })
    }

    // Registrar en historial
    await supabase
      .from('match_results_history')
      .insert({
        match_id: matchId,
        tournament_id: tournamentId,
        user_id: user.id,
        operation_type: startMatch ? 'START_MATCH' : 'ASSIGN_COURT',
        result_data: {
          court: court.trim(),
          operation: startMatch ? 'start_match' : 'assign_court',
          timestamp: new Date().toISOString()
        },
        previous_status: previousStatus,
        new_status: newStatus,
        operation_metadata: {
          round: match.round,
          order: match.order_in_round,
          has_both_couples: !!(match.couple1_id && match.couple2_id)
        }
      })

    // Log de auditoría adicional
    await supabase
      .from('bracket_operations_log')
      .insert({
        tournament_id: tournamentId,
        operation_type: startMatch ? 'START_MATCH' : 'ASSIGN_COURT',
        source_match_id: matchId,
        user_id: user.id,
        operation_metadata: {
          court: court.trim(),
          previous_status: previousStatus,
          new_status: newStatus,
          timestamp: new Date().toISOString()
        }
      })

    return NextResponse.json({
      success: true,
      matchId,
      court: court.trim(),
      status: newStatus
    })

  } catch (error) {
    console.error('Assign court error:', error)
    return NextResponse.json({
      success: false,
      matchId: params.matchId,
      court: '',
      status: '',
      error: 'Internal server error'
    }, { status: 500 })
  }
}