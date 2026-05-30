import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'
import { ZoneRulesSyncService } from '@/lib/services/zone-rules-sync.service'

type TournamentLike = {
  type?: string | null
  format_type?: string | null
  format_config?: unknown
}

type ZoneLike = {
  id?: string | null
  tournament_id?: string | null
  rounds_per_couple?: number | null
}

export type ZoneMatchRulesSource =
  | 'zone.rounds_per_couple'
  | 'synced-zone-rules'
  | 'tournament.format_config'
  | 'tournament.format_type'
  | 'legacy-couple-count'

export type ZoneMatchRules = {
  maxMatchesPerCouple: number
  coupleCount: number
  source: ZoneMatchRulesSource
}

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

export class ZoneMatchRulesService {
  static resolveRules(params: {
    tournament?: TournamentLike | null
    zone?: ZoneLike | null
    coupleCount: number
  }): ZoneMatchRules {
    const { tournament, zone, coupleCount } = params

    if (coupleCount <= 1) {
      return {
        maxMatchesPerCouple: 0,
        coupleCount,
        source: tournament ? 'tournament.format_config' : 'legacy-couple-count',
      }
    }

    if (isPositiveNumber(zone?.rounds_per_couple)) {
      return {
        maxMatchesPerCouple: zone.rounds_per_couple,
        coupleCount,
        source: 'zone.rounds_per_couple',
      }
    }

    if (tournament) {
      const rules = TournamentFormatRulesService.resolve({ tournament, zone, coupleCount })

      if (rules.matchesPerCouple > 0) {
        return {
          maxMatchesPerCouple: rules.matchesPerCouple,
          coupleCount,
          source: rules.source === 'tournament.format_config'
            ? 'tournament.format_config'
            : 'tournament.format_type',
        }
      }
    }

    return {
      maxMatchesPerCouple: coupleCount === 5 ? 3 : 2,
      coupleCount,
      source: 'legacy-couple-count',
    }
  }

  static async getRulesForZone(supabase: any, zoneId: string): Promise<ZoneMatchRules> {
    const syncResult = await ZoneRulesSyncService.syncZoneRulesForZone(supabase, zoneId)

    if (!syncResult.success) {
      throw new Error(syncResult.error || 'No se pudieron resolver las reglas de zona')
    }

    return {
      maxMatchesPerCouple: syncResult.roundsPerCouple ?? 0,
      coupleCount: syncResult.coupleCount,
      source: syncResult.changed ? 'synced-zone-rules' : 'zone.rounds_per_couple',
    }
  }
}
