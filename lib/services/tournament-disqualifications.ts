export const ACTIVE_DISQUALIFICATION_STATUS = 'ACTIVE' as const
export const REVERTED_DISQUALIFICATION_STATUS = 'REVERTED' as const

export type DisqualificationStatus =
  | typeof ACTIVE_DISQUALIFICATION_STATUS
  | typeof REVERTED_DISQUALIFICATION_STATUS

export interface ActiveDisqualification {
  id: string
  tournament_id: string
  couple_id: string
  player1_id: string
  player2_id: string
  phase: 'ZONE_PHASE' | 'BRACKET_PHASE'
  round: string | null
  zone_id: string | null
  match_id: string | null
  reason: string | null
  status: DisqualificationStatus
  metadata: Record<string, unknown> | null
}

export interface ZonePositionLike {
  couple_id?: string | null
}

export function filterOutDisqualifiedCouples<T extends ZonePositionLike>(
  rows: T[] | null | undefined,
  disqualifiedCoupleIds: Set<string>
): T[] {
  return (rows || []).filter((row) => {
    if (!row.couple_id) {
      return true
    }

    return !disqualifiedCoupleIds.has(row.couple_id)
  })
}

export function toIdSet(rows: Array<{ couple_id?: string | null }> | null | undefined): Set<string> {
  return new Set((rows || []).map((row) => row.couple_id).filter(Boolean) as string[])
}

export async function getActiveDisqualifiedCoupleIds(
  tournamentId: string,
  supabase: any
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('tournament_couple_disqualifications')
    .select('couple_id')
    .eq('tournament_id', tournamentId)
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)

  if (error) {
    throw new Error(`Error fetching active disqualifications: ${error.message}`)
  }

  return toIdSet(data)
}

export async function getActiveDisqualificationMatchIds(
  tournamentId: string,
  supabase: any
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('tournament_couple_disqualifications')
    .select('match_id')
    .eq('tournament_id', tournamentId)
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)
    .not('match_id', 'is', null)

  if (error) {
    throw new Error(`Error fetching disqualified match ids: ${error.message}`)
  }

  return new Set((data || []).map((row: { match_id: string | null }) => row.match_id).filter(Boolean) as string[])
}

export async function getActiveDisqualificationForCouple(
  tournamentId: string,
  coupleId: string,
  supabase: any
): Promise<ActiveDisqualification | null> {
  const { data, error } = await supabase
    .from('tournament_couple_disqualifications')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('couple_id', coupleId)
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)
    .maybeSingle()

  if (error) {
    throw new Error(`Error fetching active couple disqualification: ${error.message}`)
  }

  return data || null
}
