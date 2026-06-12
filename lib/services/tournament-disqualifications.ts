export const ACTIVE_DISQUALIFICATION_STATUS = 'ACTIVE' as const
export const REVERTED_DISQUALIFICATION_STATUS = 'REVERTED' as const

export type DisqualificationPhase = 'ZONE_PHASE' | 'BRACKET_PHASE'

export interface ActiveDisqualification {
  id: string
  tournament_id: string
  couple_id: string
  player1_id: string
  player2_id: string
  phase: DisqualificationPhase
  round: string | null
  zone_id: string | null
  match_id: string | null
  reason: string | null
  status: typeof ACTIVE_DISQUALIFICATION_STATUS | typeof REVERTED_DISQUALIFICATION_STATUS
  metadata: Record<string, any> | null
}

export interface CoupleIdLike {
  couple_id?: string | null
  coupleId?: string | null
}

export function getCoupleId(row: CoupleIdLike): string | null {
  return row.couple_id || row.coupleId || null
}

export function toCoupleIdSet(rows: CoupleIdLike[] | null | undefined): Set<string> {
  return new Set((rows || []).map(getCoupleId).filter(Boolean) as string[])
}

export function filterOutDisqualifiedCouples<T extends CoupleIdLike>(
  rows: T[] | null | undefined,
  disqualifiedCoupleIds: Set<string>
): T[] {
  return (rows || []).filter((row) => {
    const coupleId = getCoupleId(row)
    return !coupleId || !disqualifiedCoupleIds.has(coupleId)
  })
}

export function isValidCompetitiveDisqualification(row: ActiveDisqualification): boolean {
  return row.phase === 'ZONE_PHASE' || Boolean(row.match_id)
}

export async function revertActiveBracketDisqualificationsForMatches(
  tournamentId: string,
  matchIds: string[],
  supabase: any,
  options: { revertedBy?: string | null; reason?: string } = {}
): Promise<{ revertedCount: number; coupleIds: string[] }> {
  const uniqueMatchIds = Array.from(new Set(matchIds.filter(Boolean)))
  if (uniqueMatchIds.length === 0) {
    return { revertedCount: 0, coupleIds: [] }
  }

  const { data: rows, error: selectError } = await supabase
    .from('tournament_couple_disqualifications')
    .select('id, couple_id, metadata')
    .eq('tournament_id', tournamentId)
    .eq('phase', 'BRACKET_PHASE')
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)
    .in('match_id', uniqueMatchIds)

  if (selectError) {
    throw new Error(`Error fetching bracket disqualifications for matches: ${selectError.message}`)
  }

  const disqualifications = rows || []
  if (disqualifications.length === 0) {
    return { revertedCount: 0, coupleIds: [] }
  }

  const disqualificationIds = disqualifications.map((row: { id: string }) => row.id)
  const coupleIds = Array.from(
    new Set(disqualifications.map((row: { couple_id: string }) => row.couple_id).filter(Boolean))
  )
  const revertedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('tournament_couple_disqualifications')
    .update({
      status: REVERTED_DISQUALIFICATION_STATUS,
      reverted_by: options.revertedBy || null,
      reverted_at: revertedAt,
      updated_at: revertedAt,
    })
    .in('id', disqualificationIds)
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)

  if (updateError) {
    throw new Error(`Error reverting bracket disqualifications: ${updateError.message}`)
  }

  if (coupleIds.length > 0) {
    const { error: inscriptionError } = await supabase
      .from('inscriptions')
      .update({
        is_eliminated: false,
        eliminated_at: null,
        eliminated_in_round: null,
      })
      .eq('tournament_id', tournamentId)
      .in('couple_id', coupleIds)

    if (inscriptionError) {
      throw new Error(`Error restoring disqualified inscriptions: ${inscriptionError.message}`)
    }
  }

  return { revertedCount: disqualifications.length, coupleIds }
}

export async function getActiveDisqualifications(
  tournamentId: string,
  supabase: any,
  phase?: DisqualificationPhase
): Promise<ActiveDisqualification[]> {
  let query = supabase
    .from('tournament_couple_disqualifications')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', ACTIVE_DISQUALIFICATION_STATUS)

  if (phase) {
    query = query.eq('phase', phase)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error fetching active disqualifications: ${error.message}`)
  }

  return (data || []) as ActiveDisqualification[]
}

export async function getActiveDisqualifiedCoupleIds(
  tournamentId: string,
  supabase: any
): Promise<Set<string>> {
  const rows = await getActiveDisqualifications(tournamentId, supabase)
  return toCoupleIdSet(rows.filter(isValidCompetitiveDisqualification))
}

export async function getActiveDisqualificationMatchIds(
  tournamentId: string,
  supabase: any
): Promise<Set<string>> {
  const rows = await getActiveDisqualifications(tournamentId, supabase, 'BRACKET_PHASE')
  return new Set(rows.map((row) => row.match_id).filter(Boolean) as string[])
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

  return (data as ActiveDisqualification | null) || null
}

export function matchInvolvesDisqualifiedCouple(
  match: { couple1_id?: string | null; couple2_id?: string | null },
  disqualifiedCoupleIds: Set<string>
): boolean {
  return Boolean(
    (match.couple1_id && disqualifiedCoupleIds.has(match.couple1_id)) ||
    (match.couple2_id && disqualifiedCoupleIds.has(match.couple2_id))
  )
}
