import { createClient } from '@/utils/supabase/server'

export interface LongTournamentValidationResult {
  canGenerate: boolean
  reason?: string
  details?: {
    totalCouples: number
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
    // Qualifying advancement settings
    qualifyingAdvancementEnabled?: boolean
    couplesAdvance?: number
    totalCouplesAdvancing?: number
  }
}

/**
 * Validates if a LONG format tournament is ready for bracket generation
 * Requirement: All couples must have played exactly 3 zone matches
 */
export async function validateLongTournamentForBracket(
  tournamentId: string
): Promise<LongTournamentValidationResult> {
  const supabase = await createClient()

  try {
    // 1. Verificar que es formato LONG
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('type, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return {
        canGenerate: false,
        reason: 'Tournament not found or error fetching tournament data'
      }
    }

    if (tournament.type !== 'LONG') {
      return {
        canGenerate: false,
        reason: 'Not a LONG format tournament'
      }
    }

    if (tournament.status !== 'ZONE_PHASE') {
      return {
        canGenerate: false,
        reason: 'Tournament must be in ZONE_PHASE to generate bracket'
      }
    }

    // 2. Obtener configuración de avance clasificatorio
    const { data: rankingConfig, error: configError } = await supabase
      .from('tournament_ranking_config')
      .select('qualifying_advancement_settings')
      .eq('tournament_id', tournamentId)
      .eq('is_active', true)
      .single()

    let qualifyingAdvancementEnabled = false
    let couplesAdvance = null

    if (!configError && rankingConfig?.qualifying_advancement_settings) {
      const settings = rankingConfig.qualifying_advancement_settings
      qualifyingAdvancementEnabled = settings.enabled === true
      couplesAdvance = settings.couples_advance
    }

    console.log(`[LONG-VALIDATION] Qualifying advancement: ${qualifyingAdvancementEnabled ? `enabled (${couplesAdvance} couples)` : 'disabled'}`)

    // 3. Obtener todas las parejas en el torneo
    const { data: couples, error: couplesError } = await supabase
      .from('zone_positions')
      .select('couple_id')
      .eq('tournament_id', tournamentId)

    if (couplesError || !couples || couples.length === 0) {
      return {
        canGenerate: false,
        reason: 'No couples found in tournament'
      }
    }

    console.log(`[LONG-VALIDATION] Found ${couples.length} couples to validate`)

    // Determinar cuántas parejas participarán en el bracket
    const totalCouplesAdvancing = qualifyingAdvancementEnabled
      ? Math.min(couplesAdvance || couples.length, couples.length)
      : couples.length

    console.log(`[LONG-VALIDATION] Couples advancing to bracket: ${totalCouplesAdvancing} of ${couples.length}`)

    // 4. Contar matches por pareja (ZONE round solamente)
    const coupleMatchCounts = []

    for (const couple of couples) {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, status')
        .eq('tournament_id', tournamentId)
        .eq('round', 'ZONE')
        .or(`couple1_id.eq.${couple.couple_id},couple2_id.eq.${couple.couple_id}`)
        .neq('status', 'PENDING') // Solo matches jugados (FINISHED, CANCELLED, etc.)

      if (matchesError) {
        console.error('Error counting matches for couple:', couple.couple_id, matchesError)
        continue
      }

      const matchCount = matches?.length || 0
      coupleMatchCounts.push({
        couple_id: couple.couple_id,
        matches_played: matchCount
      })

      console.log(`[LONG-VALIDATION] Couple ${couple.couple_id}: ${matchCount} matches played`)
    }

    // 4. Verificar que TODAS las parejas jugaron exactamente 3 partidos
    const incompleteCouples = coupleMatchCounts.filter(c => c.matches_played !== 3)
    const completedCouples = coupleMatchCounts.length - incompleteCouples.length

    if (incompleteCouples.length > 0) {
      console.log(`[LONG-VALIDATION] ${incompleteCouples.length} couples haven't completed 3 matches`)

      return {
        canGenerate: false,
        reason: `${incompleteCouples.length} couples haven't completed 3 matches`,
        details: {
          totalCouples: coupleMatchCounts.length,
          completedCouples,
          pendingCouples: incompleteCouples.length,
          allCouplesCompleted: false,
          incompleteCouplesDetail: incompleteCouples.map(c => ({
            couple_id: c.couple_id,
            matches_played: c.matches_played,
            matches_needed: 3 - c.matches_played
          })),
          requirement: 'Exactly 3 zone matches per couple',
          averageMatches: coupleMatchCounts.reduce((sum, c) => sum + c.matches_played, 0) / coupleMatchCounts.length,
          qualifyingAdvancementEnabled,
          couplesAdvance,
          totalCouplesAdvancing
        }
      }
    }

    console.log(`[LONG-VALIDATION] ✅ All ${coupleMatchCounts.length} couples completed 3 matches`)

    return {
      canGenerate: true,
      details: {
        totalCouples: coupleMatchCounts.length,
        completedCouples: coupleMatchCounts.length,
        pendingCouples: 0,
        allCouplesCompleted: true,
        averageMatches: 3,
        requirement: '3 zone matches per couple - ✅ SATISFIED',
        qualifyingAdvancementEnabled,
        couplesAdvance,
        totalCouplesAdvancing
      }
    }

  } catch (error: any) {
    console.error('[LONG-VALIDATION] Error validating tournament:', error)
    return {
      canGenerate: false,
      reason: `Validation error: ${error.message}`
    }
  }
}