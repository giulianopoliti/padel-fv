import { createClient } from '@/utils/supabase/server'
import { normalizePlayerDni } from '@/lib/utils/player-dni'

export interface PlayerData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  dni_is_temporary?: boolean | null
  phone: string | null
  score: number | null
  profile_image_url: string | null
  category_name: string | null
  email?: string | null
  users?: { email: string | null }
}

export interface PlayerUpdateData {
  first_name?: string
  last_name?: string
  dni?: string | null
  phone?: string
  category_name?: string
}

/**
 * Obtiene todos los jugadores de una organización (para initial load)
 */
export async function getTenantPlayers(
  page: number = 1,
  pageSize: number = 20
) {
  const supabase = await createClient()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('players')
    .select('id, first_name, last_name, dni, dni_is_temporary, phone, score, profile_image_url, category_name, users!players_user_id_fkey(email)', { count: 'exact' })
    .eq('es_prueba', false)
    .order('score', { ascending: false, nullsFirst: false })
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error fetching players:', error)
    return { players: [], total: 0, error: error.message }
  }

  const players = (data || []).map((player) => ({
    ...player,
    users: Array.isArray(player.users) ? player.users[0] : player.users
  }))

  return {
    players,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page
  }
}

export async function getOrganizationPlayers(
  _organizationId: string,
  page: number = 1,
  pageSize: number = 20
) {
  return getTenantPlayers(page, pageSize)
}

/**
 * Actualiza los datos de un jugador
 * Si cambia la categoría, ajusta automáticamente el score al lower_range
 */
export async function updatePlayer(
  playerId: string,
  updates: PlayerUpdateData
) {
  const supabase = await createClient()

  // 1. Verificar que el jugador pertenece a la organización
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('category_name, score')
    .eq('id', playerId)
    .eq('es_prueba', false)
    .single()

  if (fetchError || !player) {
    return { success: false, error: 'Jugador no encontrado' }
  }

  // 2. Si cambia la categoría, obtener el nuevo score
  const finalUpdates: any = { ...updates }

  if (updates.dni !== undefined) {
    const normalizedDni = normalizePlayerDni(updates.dni)
    finalUpdates.dni = normalizedDni.dni
    finalUpdates.dni_is_temporary = normalizedDni.dniIsTemporary

    if (normalizedDni.dni) {
      const { data: existingPlayer, error: dniError } = await supabase
        .from('players')
        .select('id')
        .eq('dni', normalizedDni.dni)
        .neq('id', playerId)
        .maybeSingle()

      if (dniError) {
        return { success: false, error: 'Error validando DNI del jugador' }
      }

      if (existingPlayer) {
        return { success: false, error: 'Ya existe un jugador con ese DNI' }
      }
    }
  }

  if (updates.category_name && updates.category_name !== player.category_name) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('lower_range')
      .eq('name', updates.category_name)
      .single()

    if (categoryError || !category) {
      return { success: false, error: 'Categoría no encontrada' }
    }

    finalUpdates.score = category.lower_range
  }

  // 3. Realizar el update
  const { data: updatedPlayer, error: updateError } = await supabase
    .from('players')
    .update(finalUpdates)
    .eq('id', playerId)
    .select('id, first_name, last_name, dni, dni_is_temporary, phone, score, profile_image_url, category_name, users!players_user_id_fkey(email)')
    .single()

  if (updateError) {
    console.error('Error updating player:', updateError)
    return { success: false, error: updateError.message }
  }

  return {
    success: true,
    player: updatedPlayer,
    scoreChanged: !!finalUpdates.score
  }
}

/**
 * Soft-delete de un jugador (marca es_prueba = true)
 */
export async function softDeletePlayer(playerId: string) {
  const supabase = await createClient()

  // 1. Verificar permisos
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('id')
    .eq('id', playerId)
    .eq('es_prueba', false)
    .single()

  if (fetchError || !player) {
    return { success: false, error: 'Jugador no encontrado' }
  }

  // 2. Soft delete
  const { error: deleteError } = await supabase
    .from('players')
    .update({ es_prueba: true })
    .eq('id', playerId)

  if (deleteError) {
    console.error('Error soft-deleting player:', deleteError)
    return { success: false, error: deleteError.message }
  }

  return { success: true }
}

/**
 * Obtiene las categorías disponibles para el selector
 */
export async function getCategories() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('name, lower_range, upper_range')
    .order('lower_range', { ascending: false })

  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  return data || []
}
