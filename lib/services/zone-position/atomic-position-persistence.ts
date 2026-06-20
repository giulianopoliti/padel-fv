type SupabaseClientLike = any

export type AtomicZonePosition = {
  couple_id: string
  position: number
  is_definitive: boolean
  points: number
  wins: number
  losses: number
  games_for: number
  games_against: number
  games_difference: number
  player_score_total: number
  tie_info: string | null
  calculated_at: string
  sets_for: number
  sets_against: number
  sets_difference: number
}

export type AtomicZoneMembershipChange = {
  couple_id: string
  from_zone_id: string | null
  to_zone_id: string | null
  to_position: number | null
}

export const replaceZonePositionsAtomically = async (
  supabase: SupabaseClientLike,
  tournamentId: string,
  zoneId: string,
  positions: AtomicZonePosition[]
): Promise<number> => {
  if (positions.length === 0) {
    throw new Error('Cannot replace zone positions with an empty ranking')
  }

  const { data, error } = await supabase.rpc('replace_zone_positions', {
    p_tournament_id: tournamentId,
    p_zone_id: zoneId,
    p_positions: positions,
  })

  if (error) {
    throw new Error(`Failed to replace zone positions atomically: ${error.message}`)
  }

  if (typeof data !== 'number' || data !== positions.length) {
    throw new Error(
      `Atomic zone position replacement returned ${String(data)} rows; expected ${positions.length}`
    )
  }

  return data
}

export const applyZoneMembershipChangesAtomically = async (
  supabase: SupabaseClientLike,
  tournamentId: string,
  changes: AtomicZoneMembershipChange[]
): Promise<number> => {
  if (changes.length === 0) {
    throw new Error('Cannot apply an empty zone membership change set')
  }

  const { data, error } = await supabase.rpc('apply_zone_membership_changes', {
    p_tournament_id: tournamentId,
    p_changes: changes,
  })

  if (error) {
    throw new Error(`Failed to apply zone membership changes atomically: ${error.message}`)
  }

  const expectedInsertions = changes.filter((change) => change.to_zone_id !== null).length
  if (typeof data !== 'number' || data !== expectedInsertions) {
    throw new Error(
      `Atomic zone membership change returned ${String(data)} inserted rows; expected ${expectedInsertions}`
    )
  }

  return data
}
