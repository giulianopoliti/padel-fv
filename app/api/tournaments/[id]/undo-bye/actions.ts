import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

type UndoByeResult = {
  success: boolean
  error?: string
  message?: string
}

export async function undoBye(matchId: string): Promise<UndoByeResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Usuario no autenticado' }
  }

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, tournament_id, status, winner_id, couple1_id, couple2_id')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Partido no encontrado' }
  }

  const permissions = await checkTournamentPermissions(user.id, match.tournament_id)
  if (!permissions.hasPermission) {
    return { success: false, error: permissions.reason || 'Permiso denegado' }
  }

  const { data: childRelation, error: relationError } = await supabase
    .from('match_hierarchy')
    .select('parent_match_id, parent_slot')
    .eq('child_match_id', matchId)
    .maybeSingle()

  if (relationError) {
    return { success: false, error: relationError.message }
  }

  const { error: resetCurrentError } = await supabase
    .from('matches')
    .update({
      status: 'PENDING',
      winner_id: null,
    })
    .eq('id', matchId)

  if (resetCurrentError) {
    return { success: false, error: resetCurrentError.message }
  }

  if (childRelation?.parent_match_id && childRelation.parent_slot) {
    const clearParentPayload =
      childRelation.parent_slot === 1
        ? {
            couple1_id: null,
            tournament_couple_seed1_id: null,
            status: 'WAITING_OPONENT',
          }
        : {
            couple2_id: null,
            tournament_couple_seed2_id: null,
            status: 'WAITING_OPONENT',
          }

    const { error: parentUpdateError } = await supabase
      .from('matches')
      .update(clearParentPayload)
      .eq('id', childRelation.parent_match_id)

    if (parentUpdateError) {
      return { success: false, error: parentUpdateError.message }
    }
  }

  return { success: true, message: 'BYE revertido correctamente' }
}

export async function processBye(matchId: string): Promise<UndoByeResult> {
  if (!matchId) {
    return { success: false, error: 'matchId requerido' }
  }

  return { success: false, error: 'processBye aún no implementado en este módulo' }
}
