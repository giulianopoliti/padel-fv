import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { createClient, createClientServiceRole } from '@/utils/supabase/server'
import {
  applyZoneMembershipChangesAtomically,
  type AtomicZoneMembershipChange,
} from './atomic-position-persistence'

export const assertTournamentManagementPermission = async (tournamentId: string): Promise<void> => {
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) {
    throw new Error('Autenticacion requerida para modificar zonas')
  }

  const permissions = await checkTournamentPermissions(user.id, tournamentId)
  if (!permissions.hasPermission) {
    throw new Error(permissions.reason || 'Sin permisos para modificar este torneo')
  }
}

export const applyAuthorizedZoneMembershipChanges = async (
  tournamentId: string,
  changes: AtomicZoneMembershipChange[]
): Promise<number> => {
  await assertTournamentManagementPermission(tournamentId)

  const serviceClient = await createClientServiceRole()
  return applyZoneMembershipChangesAtomically(serviceClient, tournamentId, changes)
}
