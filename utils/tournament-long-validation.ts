import { AdvancementPlanner } from '@/lib/services/advancement-planner.service'
import { hasFormatConfigV2 } from '@/lib/services/tournament-format-policy'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import { getZoneStageAndMatchesPerCouple } from '@/lib/services/zone-fixture-planner.service'
import { ZoneRulesSyncService } from '@/lib/services/zone-rules-sync.service'
import {
  filterOutDisqualifiedCouples,
  getActiveDisqualifiedCoupleIds,
  matchInvolvesDisqualifiedCouple,
} from '@/lib/services/tournament-disqualifications'
import { createClient } from '@/utils/supabase/server'

export interface LongTournamentValidationResult {
  canGenerate: boolean
  reason?: string
    details?: {
      totalCouples: number
      disqualifiedCouples?: number
      completedCouples: number
    pendingCouples: number
    allCouplesCompleted: boolean
    requirement: string
    incompleteCouplesDetail?: Array<{
      couple_id: string
      matches_played: number
      matches_needed: number
    }>
    averageMatches?: number
    qualifyingAdvancementEnabled?: boolean
    couplesAdvance?: number | null
    totalCouplesAdvancing?: number
  }
}

export async function validateLongTournamentForBracket(
  tournamentId: string
): Promise<LongTournamentValidationResult> {
  const supabase = await createClient()

  try {
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('type, status, format_type, format_config')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return {
        canGenerate: false,
        reason: 'Tournament not found or error fetching tournament data',
      }
    }

    if (tournament.type !== 'LONG') {
      return {
        canGenerate: false,
        reason: 'Not a LONG format tournament',
      }
    }

    if (tournament.status !== 'ZONE_PHASE') {
      return {
        canGenerate: false,
        reason: 'Tournament must be in ZONE_PHASE to generate bracket',
      }
    }

    const { data: couples, error: couplesError } = await supabase
      .from('zone_positions')
      .select('couple_id')
      .eq('tournament_id', tournamentId)

    if (couplesError || !couples || couples.length === 0) {
      return {
        canGenerate: false,
        reason: 'No couples found in tournament',
      }
    }

    const disqualifiedCoupleIds = await getActiveDisqualifiedCoupleIds(tournamentId, supabase)
    const activeCouples = filterOutDisqualifiedCouples(couples, disqualifiedCoupleIds)

    if (activeCouples.length === 0) {
      return {
        canGenerate: false,
        reason: 'No active couples found in tournament',
      }
    }

    const resolvedFormat = TournamentFormatResolver.getResolvedFormat(tournament, {
      totalCouples: activeCouples.length,
    })
    const formatConfig = tournament.format_config as any
    const configuredLongMatchesPerCouple =
      tournament.type === 'LONG' &&
      formatConfig?.version === 2 &&
      (formatConfig?.presetId === 'LONG_SINGLE_ZONE_BRACKET' || formatConfig?.presetId === 'LONG_SINGLE_ZONE_GOLD_SILVER') &&
      typeof formatConfig?.targetMatchesPerCouple === 'number' &&
      Number.isFinite(formatConfig.targetMatchesPerCouple) &&
      formatConfig.targetMatchesPerCouple > 0
        ? formatConfig.targetMatchesPerCouple
        : null
    const requiredMatchesPerCouple = configuredLongMatchesPerCouple ?? getZoneStageAndMatchesPerCouple(
      activeCouples.length,
      resolvedFormat
    ).matchesPerCouple

    const { data: zones } = await supabase
      .from('zones')
      .select('id')
      .eq('tournament_id', tournamentId)

    for (const zone of zones || []) {
      await ZoneRulesSyncService.syncZoneRulesForZone(supabase, zone.id)
    }

    let qualifyingAdvancementEnabled = false
    let couplesAdvance: number | null = null

    if (!hasFormatConfigV2(tournament)) {
      const { data: rankingConfig } = await supabase
        .from('tournament_ranking_config')
        .select('qualifying_advancement_settings')
        .eq('tournament_id', tournamentId)
        .eq('is_active', true)
        .single()

      if (rankingConfig?.qualifying_advancement_settings) {
        const settings = rankingConfig.qualifying_advancement_settings
        qualifyingAdvancementEnabled = settings.enabled === true
        couplesAdvance = settings.couples_advance
      }
    }

    const totalCouplesAdvancing = hasFormatConfigV2(tournament)
      ? AdvancementPlanner.selectBracketEntries(activeCouples, resolvedFormat, 'MAIN', {
          totalCouples: activeCouples.length,
        }).length
      : qualifyingAdvancementEnabled
        ? Math.min(couplesAdvance || activeCouples.length, activeCouples.length)
        : activeCouples.length

    const coupleMatchCounts = []

    for (const couple of activeCouples) {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, status, couple1_id, couple2_id')
        .eq('tournament_id', tournamentId)
        .eq('round', 'ZONE')
        .or(`couple1_id.eq.${couple.couple_id},couple2_id.eq.${couple.couple_id}`)

      if (matchesError) {
        console.error('Error counting matches for couple:', couple.couple_id, matchesError)
        continue
      }

      const countedMatches = (matches || []).filter((match) => (
        match.status === 'FINISHED' ||
        (match.status === 'CANCELED' && matchInvolvesDisqualifiedCouple(match, disqualifiedCoupleIds))
      ))

      coupleMatchCounts.push({
        couple_id: couple.couple_id,
        matches_played: countedMatches.length,
      })
    }

    const incompleteCouples = coupleMatchCounts.filter((couple) => (
      couple.matches_played !== requiredMatchesPerCouple
    ))
    const completedCouples = coupleMatchCounts.length - incompleteCouples.length
    const averageMatches = coupleMatchCounts.reduce(
      (sum, couple) => sum + couple.matches_played,
      0
    ) / coupleMatchCounts.length

    if (incompleteCouples.length > 0) {
      return {
        canGenerate: false,
        reason: `${incompleteCouples.length} couples haven't completed ${requiredMatchesPerCouple} matches`,
        details: {
          totalCouples: coupleMatchCounts.length,
          disqualifiedCouples: couples.length - activeCouples.length,
          completedCouples,
          pendingCouples: incompleteCouples.length,
          allCouplesCompleted: false,
          incompleteCouplesDetail: incompleteCouples.map((couple) => ({
            couple_id: couple.couple_id,
            matches_played: couple.matches_played,
            matches_needed: requiredMatchesPerCouple - couple.matches_played,
          })),
          requirement: `Exactly ${requiredMatchesPerCouple} finished zone matches per couple`,
          averageMatches,
          qualifyingAdvancementEnabled,
          couplesAdvance,
          totalCouplesAdvancing,
        },
      }
    }

    return {
      canGenerate: true,
      details: {
        totalCouples: coupleMatchCounts.length,
        disqualifiedCouples: couples.length - activeCouples.length,
        completedCouples: coupleMatchCounts.length,
        pendingCouples: 0,
        allCouplesCompleted: true,
        averageMatches,
        requirement: `${requiredMatchesPerCouple} finished zone matches per couple - SATISFIED`,
        qualifyingAdvancementEnabled,
        couplesAdvance,
        totalCouplesAdvancing,
      },
    }
  } catch (error: any) {
    console.error('[LONG-VALIDATION] Error validating tournament:', error)
    return {
      canGenerate: false,
      reason: `Validation error: ${error.message}`,
    }
  }
}
