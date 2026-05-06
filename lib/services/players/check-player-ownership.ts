import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { getUserClubId } from './get-user-club-id'
import { getUserOrganizacionId } from './get-user-organizacion-id'

interface OwnershipResult {
  canEdit: boolean
  canView: boolean
  isOwner: boolean
  userRole?: string
  error?: string
}

/**
 * Verifica si un usuario puede VER y/o EDITAR un jugador específico
 * en el contexto de un torneo
 *
 * REGLAS:
 * - Ver datos (DNI, teléfono): Solo si es OWNER del torneo
 * - Editar datos: Solo si es OWNER del torneo Y (club_id match O organizador_id match O ADMIN)
 *
 * @param playerId - ID del jugador a verificar
 * @param currentUserId - ID del usuario actual
 * @param tournamentId - ID del torneo en contexto
 * @returns OwnershipResult con canView, canEdit e isOwner
 */
export async function checkPlayerOwnership(
  playerId: string,
  currentUserId: string,
  tournamentId: string
): Promise<OwnershipResult> {
  try {
    const supabase = await createClient()

    // 1. Verificar permisos del torneo
    const tournamentPermissions = await checkTournamentPermissions(currentUserId, tournamentId)

    if (!tournamentPermissions.hasPermission) {
      return {
        canEdit: false,
        canView: false,
        isOwner: false,
        error: 'No tienes permisos sobre este torneo'
      }
    }

    // 2. El usuario ES owner del torneo, puede VER todos los jugadores
    const userRole = tournamentPermissions.userRole

    // 3. Si es ADMIN, puede EDITAR todos los jugadores
    if (userRole === 'ADMIN') {
      return {
        canEdit: true,
        canView: true,
        isOwner: true,
        userRole,
        error: undefined
      }
    }

    // 4. Obtener datos del jugador
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('club_id, organizador_id')
      .eq('id', playerId)
      .single()

    if (playerError || !player) {
      return {
        canEdit: false,
        canView: true, // Puede ver, pero no editar si no se encuentra el jugador
        isOwner: true,
        userRole,
        error: 'Jugador no encontrado'
      }
    }

    // 5. Para CLUB: verificar si el jugador pertenece a su club
    if (userRole === 'CLUB') {
      const userClubId = await getUserClubId(currentUserId)

      if (!userClubId) {
        return {
          canEdit: false,
          canView: true,
          isOwner: true,
          userRole,
          error: 'No se pudo obtener tu club'
        }
      }

      const canEdit = player.club_id === userClubId

      return {
        canEdit,
        canView: true,
        isOwner: true,
        userRole,
        error: canEdit ? undefined : 'Este jugador no pertenece a tu club'
      }
    }

    // 6. Para ORGANIZADOR: verificar si el jugador pertenece a su organización
    if (userRole === 'ORGANIZADOR') {
      const userOrganizacionId = await getUserOrganizacionId(currentUserId)

      if (!userOrganizacionId) {
        return {
          canEdit: false,
          canView: true,
          isOwner: true,
          userRole,
          error: 'No se pudo obtener tu organización'
        }
      }

      const canEdit = player.organizador_id === userOrganizacionId

      return {
        canEdit,
        canView: true,
        isOwner: true,
        userRole,
        error: canEdit ? undefined : 'Este jugador no pertenece a tu organización'
      }
    }

    // 7. Otros roles: solo pueden ver (ya son owners del torneo)
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
