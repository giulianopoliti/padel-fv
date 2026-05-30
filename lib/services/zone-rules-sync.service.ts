import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import { getZoneStageAndMatchesPerCouple } from '@/lib/services/zone-fixture-planner.service'
import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'

type SupabaseClientLike = any

type TournamentLike = {
  id?: string
  type?: string | null
  format_type?: string | null
  format_config?: unknown
}

type ZoneLike = {
  id: string
  tournament_id: string
  capacity?: number | null
  max_couples?: number | null
  rounds_per_couple?: number | null
}

export type ZoneCoupleCountSource = 'zone_positions' | 'zone_couples'

export type ZoneRuleMetadata = {
  capacity: number
  maxCouples: number
  roundsPerCouple: number | null
}

export type ZoneRulesSyncResult = ZoneRuleMetadata & {
  success: boolean
  zoneId: string
  tournamentId: string
  coupleCount: number
  countSource: ZoneCoupleCountSource
  changed: boolean
  error?: string
}

const asPositiveNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

const sameNullableNumber = (left: number | null | undefined, right: number | null | undefined) => {
  return (left ?? null) === (right ?? null)
}

export class ZoneRulesSyncService {
  static async countCanonicalZoneCouples(
    supabase: SupabaseClientLike,
    zoneId: string
  ): Promise<{ count: number; source: ZoneCoupleCountSource }> {
    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select('couple_id')
      .eq('zone_id', zoneId)

    if (positionsError) {
      throw new Error(positionsError.message || 'Error contando zone_positions')
    }

    if ((positions?.length || 0) > 0) {
      return { count: positions.length, source: 'zone_positions' }
    }

    const { data: legacyCouples, error: legacyError } = await supabase
      .from('zone_couples')
      .select('couple_id')
      .eq('zone_id', zoneId)

    if (legacyError) {
      throw new Error(legacyError.message || 'Error contando zone_couples')
    }

    return { count: legacyCouples?.length || 0, source: 'zone_couples' }
  }

  static resolveExpectedMetadata(params: {
    tournament?: TournamentLike | null
    zone?: Partial<ZoneLike> | null
    coupleCount: number
  }): ZoneRuleMetadata {
    const { tournament, zone, coupleCount } = params
    const capacity = coupleCount
    const existingMaxCouples = asPositiveNumber(zone?.max_couples)
    let maxCouples = Math.max(existingMaxCouples || 0, coupleCount)
    let roundsPerCouple: number | null = null

    if (tournament) {
      const resolvedFormat = TournamentFormatResolver.getResolvedFormat(tournament, { totalCouples: coupleCount })
      const configuredMaxSize = asPositiveNumber(resolvedFormat.zoneRules?.maxSize)
      if (configuredMaxSize) {
        maxCouples = configuredMaxSize
      }

      if (coupleCount >= 2) {
        roundsPerCouple = getZoneStageAndMatchesPerCouple(coupleCount, resolvedFormat).matchesPerCouple
      }
    } else if (coupleCount >= 2) {
      const rules = TournamentFormatRulesService.resolve({
        tournament: { type: null, format_type: null, format_config: null },
        zone: { rounds_per_couple: null },
        coupleCount,
      })
      roundsPerCouple = rules.matchesPerCouple
    }

    if (coupleCount < 2) {
      roundsPerCouple = null
    }

    return {
      capacity,
      maxCouples,
      roundsPerCouple,
    }
  }

  static async syncZoneRulesForZone(
    supabase: SupabaseClientLike,
    zoneId: string
  ): Promise<ZoneRulesSyncResult> {
    try {
      const { data: zone, error: zoneError } = await supabase
        .from('zones')
        .select('id, tournament_id, capacity, max_couples, rounds_per_couple')
        .eq('id', zoneId)
        .single()

      if (zoneError || !zone) {
        return {
          success: false,
          zoneId,
          tournamentId: '',
          coupleCount: 0,
          countSource: 'zone_positions',
          capacity: 0,
          maxCouples: 0,
          roundsPerCouple: null,
          changed: false,
          error: zoneError?.message || 'Zona no encontrada',
        }
      }

      const { count: coupleCount, source: countSource } = await this.countCanonicalZoneCouples(supabase, zoneId)

      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, type, format_type, format_config')
        .eq('id', zone.tournament_id)
        .single()

      if (tournamentError) {
        return {
          success: false,
          zoneId,
          tournamentId: zone.tournament_id,
          coupleCount,
          countSource,
          capacity: zone.capacity ?? 0,
          maxCouples: zone.max_couples ?? 0,
          roundsPerCouple: zone.rounds_per_couple ?? null,
          changed: false,
          error: tournamentError.message || 'No se pudo obtener el torneo',
        }
      }

      const expected = this.resolveExpectedMetadata({
        tournament,
        zone,
        coupleCount,
      })

      const changed = (
        zone.capacity !== expected.capacity ||
        zone.max_couples !== expected.maxCouples ||
        !sameNullableNumber(zone.rounds_per_couple, expected.roundsPerCouple)
      )

      if (changed) {
        const { error: updateError } = await supabase
          .from('zones')
          .update({
            capacity: expected.capacity,
            max_couples: expected.maxCouples,
            rounds_per_couple: expected.roundsPerCouple,
          })
          .eq('id', zoneId)

        if (updateError) {
          return {
            success: false,
            zoneId,
            tournamentId: zone.tournament_id,
            coupleCount,
            countSource,
            ...expected,
            changed: false,
            error: updateError.message || 'No se pudo sincronizar reglas de zona',
          }
        }
      }

      return {
        success: true,
        zoneId,
        tournamentId: zone.tournament_id,
        coupleCount,
        countSource,
        ...expected,
        changed,
      }
    } catch (error: any) {
      return {
        success: false,
        zoneId,
        tournamentId: '',
        coupleCount: 0,
        countSource: 'zone_positions',
        capacity: 0,
        maxCouples: 0,
        roundsPerCouple: null,
        changed: false,
        error: error?.message || 'Error sincronizando reglas de zona',
      }
    }
  }

  static async syncZoneRulesForZones(
    supabase: SupabaseClientLike,
    zoneIds: string[]
  ): Promise<ZoneRulesSyncResult[]> {
    const uniqueZoneIds = Array.from(new Set(zoneIds.filter(Boolean)))
    const results: ZoneRulesSyncResult[] = []

    for (const zoneId of uniqueZoneIds) {
      results.push(await this.syncZoneRulesForZone(supabase, zoneId))
    }

    return results
  }
}
