import { createClient } from '@/utils/supabase/server'

/**
 * Obtiene el club_id del usuario si es un usuario CLUB
 *
 * @param userId - ID del usuario
 * @returns club_id o null si no tiene club
 */
export async function getUserClubId(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clubes')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return data.id
  } catch (error) {
    console.error('Error getting user club_id:', error)
    return null
  }
}
