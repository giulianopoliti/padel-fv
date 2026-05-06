import { createClient } from '@/utils/supabase/server'

/**
 * Obtiene el organizacion_id del usuario si es un ORGANIZADOR activo
 *
 * @param userId - ID del usuario
 * @returns organizacion_id o null si no pertenece a ninguna organización
 */
export async function getUserOrganizacionId(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return null
    }

    return data.organizacion_id
  } catch (error) {
    console.error('Error getting user organizacion_id:', error)
    return null
  }
}
