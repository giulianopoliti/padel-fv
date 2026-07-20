'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/utils/supabase/server'
import {
  hasExternalTournamentHistory,
  uniqueStrings,
  type PlayerTournamentReference,
} from '@/lib/player-identity-transfer'

type OrganizerContext = {
  userId: string
  organizationId: string
}

type PlayerAccountResetPlayer = {
  id: string
  first_name: string | null
  last_name: string | null
  dni: string | null
  phone: string | null
  user_id: string | null
}

const accountResetSchema = z.object({
  operationId: z.string().uuid(),
  playerId: z.string().uuid(),
  expectedUserId: z.string().uuid(),
  confirmation: z.literal('BLANQUEAR'),
  reason: z.string().trim().min(5).max(500),
})

const getOrganizerContext = async (): Promise<OrganizerContext> => {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('No autenticado')

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'ORGANIZADOR') throw new Error('No autorizado')

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('organization_members')
    .select('organizacion_id, member_role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('member_role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error('Solo owners y administradores de la organizacion pueden blanquear cuentas')
  }

  return { userId: user.id, organizationId: membership.organizacion_id }
}

const getPlayerTournaments = async (playerId: string): Promise<PlayerTournamentReference[]> => {
  const { data: couples, error: couplesError } = await supabaseAdmin
    .from('couples')
    .select('id')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

  if (couplesError) throw couplesError

  const coupleIds = (couples || []).map((couple) => couple.id)
  const [directResult, coupleResult] = await Promise.all([
    supabaseAdmin.from('inscriptions').select('tournament_id').eq('player_id', playerId),
    coupleIds.length > 0
      ? supabaseAdmin.from('inscriptions').select('tournament_id').in('couple_id', coupleIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (directResult.error) throw directResult.error
  if (coupleResult.error) throw coupleResult.error

  const tournamentIds = uniqueStrings([
    ...(directResult.data || []).map((row) => row.tournament_id),
    ...(coupleResult.data || []).map((row) => row.tournament_id),
  ])

  if (tournamentIds.length === 0) return []

  const { data: tournaments, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, organization_id')
    .in('id', tournamentIds)

  if (error) throw error

  return (tournaments || []).map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    organizationId: tournament.organization_id,
  }))
}

export const resetPlayerUserAccount = async (rawInput: unknown) => {
  let auditId: string | null = null
  let shouldRestorePlayerLink: { playerId: string; userId: string } | null = null

  try {
    const context = await getOrganizerContext()
    const input = accountResetSchema.parse(rawInput)

    const { data: previousAudit } = await supabaseAdmin
      .from('player_user_account_resets')
      .select('status')
      .eq('operation_id', input.operationId)
      .maybeSingle()

    if (previousAudit?.status === 'completed') return { success: true }
    if (previousAudit) return { success: false, error: 'Esta operacion ya fue procesada' }

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, first_name, last_name, dni, phone, user_id')
      .eq('id', input.playerId)
      .maybeSingle()

    if (playerError) throw playerError
    if (!player) return { success: false, error: 'Jugador no encontrado' }
    if (player.user_id !== input.expectedUserId) {
      return { success: false, error: 'La cuenta vinculada cambio; volve a cargar el jugador' }
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, created_at, avatar_url')
      .eq('id', input.expectedUserId)
      .maybeSingle()

    if (accountError) throw accountError
    if (!account) return { success: false, error: 'La cuenta publica no existe' }
    if (account.role !== 'PLAYER') {
      return { success: false, error: 'Solo se pueden blanquear cuentas de jugadores' }
    }

    const tournaments = await getPlayerTournaments(player.id)
    if (hasExternalTournamentHistory(tournaments, context.organizationId)) {
      return { success: false, error: 'El jugador tiene historial fuera de tu organizacion. Debe resolverlo un administrador.' }
    }

    const { data: audit, error: auditError } = await supabaseAdmin
      .from('player_user_account_resets')
      .insert({
        operation_id: input.operationId,
        player_id: player.id,
        deleted_user_id: input.expectedUserId,
        deleted_email: account.email,
        organization_id: context.organizationId,
        performed_by: context.userId,
        reason: input.reason,
        player_snapshot: { ...(player as PlayerAccountResetPlayer), tournaments },
        user_snapshot: account,
      })
      .select('id')
      .single()

    if (auditError) throw auditError
    auditId = audit.id

    const { data: unlinkedPlayer, error: unlinkError } = await supabaseAdmin
      .from('players')
      .update({ user_id: null })
      .eq('id', player.id)
      .eq('user_id', input.expectedUserId)
      .select('id')
      .maybeSingle()

    if (unlinkError || !unlinkedPlayer) {
      throw unlinkError || new Error('No se pudo desvincular la cuenta del jugador')
    }

    shouldRestorePlayerLink = { playerId: player.id, userId: input.expectedUserId }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(input.expectedUserId)

    if (deleteAuthError) {
      const { data: restored, error: restoreError } = await supabaseAdmin
        .from('players')
        .update({ user_id: input.expectedUserId })
        .eq('id', player.id)
        .is('user_id', null)
        .select('id')
        .maybeSingle()

      const recoveryRequired = Boolean(restoreError || !restored)

      await supabaseAdmin
        .from('player_user_account_resets')
        .update({
          status: recoveryRequired ? 'recovery_required' : 'failed',
          error_message: deleteAuthError.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', audit.id)

      return {
        success: false,
        error: recoveryRequired
          ? 'Error critico: la cuenta requiere recuperacion administrativa'
          : 'No se pudo borrar la cuenta de acceso y el jugador fue restaurado',
      }
    }

    shouldRestorePlayerLink = null

    await supabaseAdmin
      .from('player_user_account_resets')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', audit.id)

    revalidatePath('/panel')
    revalidatePath('/panel-cpa')
    revalidatePath('/my-players')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al blanquear la cuenta'

    if (auditId) {
      let status: 'failed' | 'recovery_required' = 'failed'
      if (shouldRestorePlayerLink) {
        const { data: restored, error: restoreError } = await supabaseAdmin
          .from('players')
          .update({ user_id: shouldRestorePlayerLink.userId })
          .eq('id', shouldRestorePlayerLink.playerId)
          .is('user_id', null)
          .select('id')
          .maybeSingle()

        if (restoreError || !restored) status = 'recovery_required'
      }

      await supabaseAdmin
        .from('player_user_account_resets')
        .update({
          status,
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)

      if (status === 'recovery_required') {
        return { success: false, error: 'Error critico: la cuenta requiere recuperacion administrativa' }
      }
    }

    return { success: false, error: message }
  }
}
