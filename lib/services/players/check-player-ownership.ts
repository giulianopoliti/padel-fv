import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface OwnershipResult {
  canEdit: boolean
  canView: boolean
  isOwner: boolean
  userRole?: string
  error?: string
}

/**
 * Verifica si un usuario puede ver y/o editar un jugador en el contexto de un torneo.
 *
 * En produccion cada tenant usa su propia base Supabase, asi que el permiso de
 * edicion depende del permiso sobre el torneo, no de una organizacion guardada
 * en players.
 */
export async function checkPlayerOwnership(
  playerId: string,
  currentUserId: string,
  tournamentId: string
): Promise<OwnershipResult> {
  try {
    const supabase = await createClient()

    const tournamentPermissions = await checkTournamentPermissions(currentUserId, tournamentId)

    if (!tournamentPermissions.hasPermission) {
      return {
        canEdit: false,
        canView: false,
        isOwner: false,
        error: 'No tienes permisos sobre este torneo'
      }
    }

    const userRole = tournamentPermissions.userRole

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .single()

    if (playerError || !player) {
      return {
        canEdit: false,
        canView: true,
        isOwner: true,
        userRole,
        error: 'Jugador no encontrado'
      }
    }

    if (userRole === 'ADMIN' || userRole === 'CLUB' || userRole === 'ORGANIZADOR') {
      return {
        canEdit: true,
        canView: true,
        isOwner: true,
        userRole
      }
    }

    return {
      canEdit: false,
      canView: true,
      isOwner: true,
      userRole,
      error: 'Rol no autorizado para editar jugadores'
    }
  } catch (error) {
    console.error('Error checking player ownership:', error)
    return {
      canEdit: false,
      canView: false,
      isOwner: false,
      error: 'Error al verificar permisos'
    }
  }
}
