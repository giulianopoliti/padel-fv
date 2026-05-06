import { createClient } from './server'
import type { DetailedUserDetails } from '@/types'

/**
 * Obtiene los detalles completos del usuario autenticado desde el servidor
 */
export async function getUserDetails(): Promise<DetailedUserDetails | null> {
  try {
    const supabase = await createClient()

    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[getUserDetails] Auth user:', user?.id)
    console.log('[getUserDetails] Auth error:', authError)

    if (authError || !user) {
      console.log('[getUserDetails] No authenticated user')
      return null
    }

    // Obtener datos básicos directamente desde la base de datos
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        players!users_id_fkey(
          id
        ),
        clubes!users_id_fkey(
          id
        ),
        coaches!users_id_fkey(
          id
        )
      `)
      .eq('id', user.id)
      .single()

    console.log('[getUserDetails] User data:', userData)
    console.log('[getUserDetails] User error:', userError)

    if (userError || !userData) {
      console.log('[getUserDetails] Error fetching user data')
      return null
    }

    // Construir el objeto DetailedUserDetails
    const userDetails: DetailedUserDetails = {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      player_id: userData.players?.[0]?.id || null,
      club_id: userData.clubes?.[0]?.id || null,
      coach_id: userData.coaches?.[0]?.id || null
    }

    console.log('[getUserDetails] Final user details:', userDetails)
    return userDetails

  } catch (error) {
    console.error('[getUserDetails] Error:', error)
    return null
  }
}