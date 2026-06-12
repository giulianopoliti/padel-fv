import { NextRequest, NextResponse } from 'next/server'
import { advanceWinnerUsingHierarchy } from '@/app/api/tournaments/actions'
import {
  getActiveDisqualificationForCouple,
  type ActiveDisqualification,
} from '@/lib/services/tournament-disqualifications'
import { createClient, createClientServiceRole } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

const ACTIVE_MATCH_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_OPONENT'] as const

type RouteParams = {
  params: Promise<{
    id: string
    coupleId: string
  }>
}

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : 'Error inesperado'
)

async function authenticateOrganizer(tournamentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      userId: null,
      error: NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 }),
    }
  }

  const permission = await checkTournamentPermissions(user.id, tournamentId)
  if (!permission.hasPermission) {
    return {
      userId: null,
      error: NextResponse.json(
        { success: false, error: permission.reason || 'Permisos insuficientes' },
        { status: 403 }
      ),
    }
  }

  return { userId: user.id, error: null }
}

async function setCoupleEliminated(
  supabase: any,
  tournamentId: string,
  coupleId: string,
  isEliminated: boolean,
  round: string | null = null
) {
  const payload = isEliminated
    ? {
        is_eliminated: true,
        eliminated_at: new Date().toISOString(),
        eliminated_in_round: round,
      }
    : {
        is_eliminated: false,
        eliminated_at: null,
        eliminated_in_round: null,
      }

  const { error } = await supabase
    .from('inscriptions')
    .update(payload)
    .eq('tournament_id', tournamentId)
    .eq('couple_id', coupleId)

  if (error) {
    throw new Error(`Error actualizando inscripciones: ${error.message}`)
  }
}

function disqualificationMetadata<T = Record<string, any>>(
  disqualification: ActiveDisqualification
): T {
  return (disqualification.metadata || {}) as T
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: tournamentId, coupleId } = await params

  try {
    const auth = await authenticateOrganizer(tournamentId)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null
    const requestedMatchId = typeof body.matchId === 'string' ? body.matchId : null
    const supabase = await createClientServiceRole()

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, type, status, bracket_status, bracket_generated_at')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ success: false, error: 'Torneo no encontrado' }, { status: 404 })
    }

    if (!['AMERICAN', 'LONG'].includes(tournament.type)) {
      return NextResponse.json(
        { success: false, error: 'La descalificacion administrativa solo aplica a torneos AMERICAN o LONG' },
        { status: 400 }
      )
    }

    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('id, player1_id, player2_id')
      .eq('id', coupleId)
      .single()

    if (coupleError || !couple) {
      return NextResponse.json({ success: false, error: 'Pareja no encontrada' }, { status: 404 })
    }

    const active = await getActiveDisqualificationForCouple(tournamentId, coupleId, supabase)
    if (active) {
      return NextResponse.json(
        { success: false, error: 'La pareja ya tiene una descalificacion activa' },
        { status: 409 }
      )
    }

    if (tournament.status === 'ZONE_PHASE') {
      const { data: zonePosition } = await supabase
        .from('zone_positions')
        .select('zone_id, position')
        .eq('tournament_id', tournamentId)
        .eq('couple_id', coupleId)
        .maybeSingle()

      const { data: pendingMatches, error: pendingError } = await supabase
        .from('matches')
        .select('id, status')
        .eq('tournament_id', tournamentId)
        .eq('round', 'ZONE')
        .in('status', ACTIVE_MATCH_STATUSES)
        .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)

      if (pendingError) {
        throw new Error(`Error buscando partidos pendientes: ${pendingError.message}`)
      }

      const { data: disqualification, error: insertError } = await supabase
        .from('tournament_couple_disqualifications')
        .insert({
          tournament_id: tournamentId,
          couple_id: coupleId,
          player1_id: couple.player1_id,
          player2_id: couple.player2_id,
          phase: 'ZONE_PHASE',
          round: 'ZONE',
          zone_id: zonePosition?.zone_id || null,
          reason,
          status: 'ACTIVE',
          disqualified_by: auth.userId,
          metadata: {
            zone_position: zonePosition?.position || null,
            canceled_matches: (pendingMatches || []).map((match: any) => ({
              id: match.id,
              previous_status: match.status,
            })),
          },
        })
        .select('*')
        .single()

      if (insertError) {
        throw new Error(`Error registrando descalificacion: ${insertError.message}`)
      }

      if ((pendingMatches || []).length > 0) {
        const { error: cancelError } = await supabase
          .from('matches')
          .update({ status: 'CANCELED' })
          .eq('tournament_id', tournamentId)
          .eq('round', 'ZONE')
          .in('status', ACTIVE_MATCH_STATUSES)
          .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)

        if (cancelError) {
          throw new Error(`Error cancelando partidos pendientes: ${cancelError.message}`)
        }
      }

      await setCoupleEliminated(supabase, tournamentId, coupleId, true, 'ZONE')

      return NextResponse.json({
        success: true,
        message: 'Pareja descalificada de la fase de zonas',
        disqualification,
      })
    }

    if (tournament.status === 'BRACKET_PHASE') {
      let matchQuery = supabase
        .from('matches')
        .select('id, status, round, couple1_id, couple2_id, winner_id, result_couple1, result_couple2')
        .eq('tournament_id', tournamentId)
        .eq('type', 'ELIMINATION')

      matchQuery = requestedMatchId
        ? matchQuery.eq('id', requestedMatchId)
        : matchQuery
            .in('status', ACTIVE_MATCH_STATUSES)
            .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)
            .limit(1)

      const { data: matches, error: matchError } = await matchQuery
      const match = Array.isArray(matches) ? matches[0] : matches

      if (matchError || !match) {
        return NextResponse.json(
          { success: false, error: 'No se encontro un match activo de llave para esa pareja' },
          { status: 404 }
        )
      }

      if (!ACTIVE_MATCH_STATUSES.includes(match.status as typeof ACTIVE_MATCH_STATUSES[number])) {
        return NextResponse.json(
          { success: false, error: 'Solo se puede descalificar en un match de llave pendiente o en curso' },
          { status: 400 }
        )
      }

      if (match.couple1_id !== coupleId && match.couple2_id !== coupleId) {
        return NextResponse.json(
          { success: false, error: 'La pareja no participa en el match indicado' },
          { status: 400 }
        )
      }

      const opponentId = match.couple1_id === coupleId ? match.couple2_id : match.couple1_id
      if (!opponentId) {
        return NextResponse.json(
          { success: false, error: 'No hay rival valido para avanzar por descalificacion' },
          { status: 400 }
        )
      }

      const { data: disqualification, error: insertError } = await supabase
        .from('tournament_couple_disqualifications')
        .insert({
          tournament_id: tournamentId,
          couple_id: coupleId,
          player1_id: couple.player1_id,
          player2_id: couple.player2_id,
          phase: 'BRACKET_PHASE',
          round: match.round,
          match_id: match.id,
          reason,
          status: 'ACTIVE',
          disqualified_by: auth.userId,
          metadata: {
            opponent_id: opponentId,
            previous_match_state: {
              status: match.status,
              winner_id: match.winner_id,
              result_couple1: match.result_couple1,
              result_couple2: match.result_couple2,
            },
          },
        })
        .select('*')
        .single()

      if (insertError) {
        throw new Error(`Error registrando descalificacion: ${insertError.message}`)
      }

      const resultCouple1 = match.couple1_id === opponentId ? 'W/DQ' : 'DQ'
      const resultCouple2 = match.couple2_id === opponentId ? 'W/DQ' : 'DQ'

      const { error: finishError } = await supabase
        .from('matches')
        .update({
          status: 'FINISHED',
          winner_id: opponentId,
          result_couple1: resultCouple1,
          result_couple2: resultCouple2,
        })
        .eq('id', match.id)
        .eq('tournament_id', tournamentId)

      if (finishError) {
        throw new Error(`Error cerrando match por descalificacion: ${finishError.message}`)
      }

      await setCoupleEliminated(supabase, tournamentId, coupleId, true, match.round)
      await advanceWinnerUsingHierarchy(supabase, tournamentId, match.id, opponentId, 'normal_win')

      return NextResponse.json({
        success: true,
        message: 'Match ganado por descalificacion',
        disqualification,
        matchId: match.id,
        winnerId: opponentId,
      })
    }

    return NextResponse.json(
      { success: false, error: 'El torneo debe estar en fase de zonas o llave' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[CoupleDisqualification:POST]', error)
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: tournamentId, coupleId } = await params

  try {
    const auth = await authenticateOrganizer(tournamentId)
    if (auth.error) return auth.error

    const supabase = await createClientServiceRole()

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, status, bracket_status, bracket_generated_at')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ success: false, error: 'Torneo no encontrado' }, { status: 404 })
    }

    const disqualification = await getActiveDisqualificationForCouple(tournamentId, coupleId, supabase)
    if (!disqualification) {
      return NextResponse.json(
        { success: false, error: 'La pareja no tiene una descalificacion activa' },
        { status: 404 }
      )
    }

    if (disqualification.phase === 'ZONE_PHASE') {
      const bracketAlreadyGenerated =
        tournament.status !== 'ZONE_PHASE' ||
        tournament.bracket_generated_at ||
        tournament.bracket_status === 'BRACKET_GENERATED' ||
        tournament.bracket_status === 'BRACKET_ACTIVE'

      if (bracketAlreadyGenerated) {
        return NextResponse.json(
          { success: false, error: 'No se puede revertir una descalificacion de zonas si la llave ya fue generada' },
          { status: 400 }
        )
      }

      const metadata = disqualificationMetadata<{
        canceled_matches?: Array<{ id: string; previous_status?: string }>
      }>(disqualification)

      for (const match of metadata.canceled_matches || []) {
        if (!match.id || !match.previous_status) continue

        await supabase
          .from('matches')
          .update({ status: match.previous_status })
          .eq('id', match.id)
          .eq('tournament_id', tournamentId)
          .eq('status', 'CANCELED')
          .is('winner_id', null)
      }

      await setCoupleEliminated(supabase, tournamentId, coupleId, false)
    } else {
      if (!disqualification.match_id) {
        return NextResponse.json(
          { success: false, error: 'La descalificacion de llave no tiene match asociado' },
          { status: 400 }
        )
      }

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('id, round, couple1_id, couple2_id, winner_id')
        .eq('id', disqualification.match_id)
        .eq('tournament_id', tournamentId)
        .single()

      if (matchError || !match) {
        return NextResponse.json({ success: false, error: 'Match de descalificacion no encontrado' }, { status: 404 })
      }

      const { data: hierarchy } = await supabase
        .from('match_hierarchy')
        .select('parent_match_id, parent_slot')
        .eq('tournament_id', tournamentId)
        .eq('child_match_id', match.id)
        .maybeSingle()

      if (hierarchy?.parent_match_id && match.winner_id) {
        const { data: parentMatch, error: parentError } = await supabase
          .from('matches')
          .select('id, status, winner_id, couple1_id, couple2_id')
          .eq('id', hierarchy.parent_match_id)
          .eq('tournament_id', tournamentId)
          .single()

        if (parentError || !parentMatch) {
          return NextResponse.json({ success: false, error: 'Match siguiente no encontrado' }, { status: 404 })
        }

        const downstreamStarted =
          parentMatch.status === 'IN_PROGRESS' ||
          parentMatch.status === 'FINISHED' ||
          Boolean(parentMatch.winner_id)

        if (downstreamStarted) {
          return NextResponse.json(
            { success: false, error: 'No se puede revertir: el match siguiente ya empezo o tiene resultado' },
            { status: 400 }
          )
        }

        const slotField = hierarchy.parent_slot === 1 ? 'couple1_id' : 'couple2_id'
        if (parentMatch[slotField] === match.winner_id) {
          const { error: parentUpdateError } = await supabase
            .from('matches')
            .update({ [slotField]: null, status: 'WAITING_OPONENT' })
            .eq('id', parentMatch.id)
            .eq('tournament_id', tournamentId)

          if (parentUpdateError) {
            throw new Error(`Error limpiando match siguiente: ${parentUpdateError.message}`)
          }
        }
      }

      const metadata = disqualificationMetadata<{
        previous_match_state?: {
          status?: string
          winner_id?: string | null
          result_couple1?: string | null
          result_couple2?: string | null
        }
      }>(disqualification)
      const previous = metadata.previous_match_state

      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          status: previous?.status || 'PENDING',
          winner_id: previous?.winner_id || null,
          result_couple1: previous?.result_couple1 || null,
          result_couple2: previous?.result_couple2 || null,
        })
        .eq('id', match.id)
        .eq('tournament_id', tournamentId)

      if (matchUpdateError) {
        throw new Error(`Error restaurando match: ${matchUpdateError.message}`)
      }

      await setCoupleEliminated(supabase, tournamentId, coupleId, false)
    }

    const { error: revertError } = await supabase
      .from('tournament_couple_disqualifications')
      .update({
        status: 'REVERTED',
        reverted_by: auth.userId,
        reverted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', disqualification.id)
      .eq('status', 'ACTIVE')

    if (revertError) {
      throw new Error(`Error revirtiendo descalificacion: ${revertError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Descalificacion revertida correctamente',
    })
  } catch (error) {
    console.error('[CoupleDisqualification:DELETE]', error)
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 })
  }
}
