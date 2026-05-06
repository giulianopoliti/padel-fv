import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

type LinkParams = {
  supabase: any
  userId: string
  tournamentId: string
  clubIds: string[]
}

async function getUserRoleAndOrgId(supabase: any, userId: string): Promise<{ role: string | null; organizacion_id: string | null }> {
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  const role = userData?.role ?? null

  if (role !== 'ORGANIZADOR') return { role, organizacion_id: null }

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organizacion_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return { role, organizacion_id: orgMember?.organizacion_id ?? null }
}

async function validateClubOwnershipForUser(supabase: any, userId: string, clubIds: string[]): Promise<{ valid: boolean; message?: string }> {
  const { role, organizacion_id } = await getUserRoleAndOrgId(supabase, userId)

  if (!role) return { valid: false, message: 'Rol de usuario no encontrado' }

  if (role === 'ADMIN') return { valid: true }

  if (role === 'CLUB') {
    // CLUB users can only manage their own club
    const { data: ownClub } = await supabase
      .from('clubes')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!ownClub) return { valid: false, message: 'No se encontró el club del usuario' }

    const invalid = clubIds.find((id) => id !== ownClub.id)
    if (invalid) return { valid: false, message: 'No puedes gestionar clubes ajenos' }
    return { valid: true }
  }

  if (role === 'ORGANIZADOR') {
    if (!organizacion_id) return { valid: false, message: 'No se encontró la organización del usuario' }
    if (clubIds.length === 0) return { valid: true }

    // Verify all clubIds belong to this organization
    const { data: matches, error } = await supabase
      .from('organization_clubs')
      .select('club_id')
      .eq('organizacion_id', organizacion_id)
      .in('club_id', clubIds)

    if (error) return { valid: false, message: error.message }

    const matchedIds = new Set((matches || []).map((m: any) => m.club_id))
    const missing = clubIds.filter((id) => !matchedIds.has(id))
    if (missing.length > 0) {
      return { valid: false, message: 'Algunos clubes no pertenecen a tu organización' }
    }
    return { valid: true }
  }

  return { valid: false, message: 'Rol no autorizado' }
}

export async function linkTournamentClubs({ supabase, userId, tournamentId, clubIds }: LinkParams): Promise<{ success: boolean; message?: string }> {
  const permission = await checkTournamentPermissions(userId, tournamentId)
  if (!permission.hasPermission) return { success: false, message: permission.reason || 'Sin permisos' }

  const ids = Array.from(new Set((clubIds || []).filter(Boolean)))
  if (ids.length === 0) return { success: true }

  const ownership = await validateClubOwnershipForUser(supabase, userId, ids)
  if (!ownership.valid) return { success: false, message: ownership.message }

  const rows = ids.map((club_id) => ({ tournament_id: tournamentId, club_id }))
  const { error } = await supabase
    .from('clubes_tournament')
    .upsert(rows, { onConflict: 'tournament_id,club_id', ignoreDuplicates: true })

  if (error) return { success: false, message: error.message }
  return { success: true }
}

export async function unlinkTournamentClubs({ supabase, userId, tournamentId, clubIds }: LinkParams): Promise<{ success: boolean; message?: string }> {
  const permission = await checkTournamentPermissions(userId, tournamentId)
  if (!permission.hasPermission) return { success: false, message: permission.reason || 'Sin permisos' }

  const ids = Array.from(new Set((clubIds || []).filter(Boolean)))
  if (ids.length === 0) return { success: true }

  const ownership = await validateClubOwnershipForUser(supabase, userId, ids)
  if (!ownership.valid) return { success: false, message: ownership.message }

  // Get tournament data to check club_id
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('club_id')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, message: 'No se pudo verificar el torneo' }
  }

  // Prevent removing the main club (club_id from tournaments table)
  if (tournament.club_id && ids.includes(tournament.club_id)) {
    return {
      success: false,
      message: 'No puedes eliminar el club principal del torneo. Este club está vinculado directamente en el campo club_id y es necesario para el funcionamiento del sistema.'
    }
  }

  // Check if removing these clubs would leave the tournament with NO clubs at all
  const { data: currentClubs, error: currentClubsError } = await supabase
    .from('clubes_tournament')
    .select('club_id')
    .eq('tournament_id', tournamentId)

  if (currentClubsError) {
    return { success: false, message: 'Error al verificar clubes actuales' }
  }

  const remainingClubIds = (currentClubs || [])
    .map((c: any) => c.club_id)
    .filter((id: string) => !ids.includes(id))

  // If tournament has a club_id set, we allow removal as long as club_id stays
  // If tournament doesn't have club_id, we need at least one club in clubes_tournament
  if (!tournament.club_id && remainingClubIds.length === 0) {
    return {
      success: false,
      message: 'Debes mantener al menos un club asociado al torneo'
    }
  }

  const { error } = await supabase
    .from('clubes_tournament')
    .delete()
    .in('club_id', ids)
    .eq('tournament_id', tournamentId)

  if (error) return { success: false, message: error.message }
  return { success: true }
}


