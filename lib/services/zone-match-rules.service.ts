import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'

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
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('id, tournament_id, rounds_per_couple')
      .eq('id', zoneId)
      .single()

    if (zoneError || !zone) {
      throw new Error('Zona no encontrada')
    }

    const { data: zonePositions, error: positionsError } = await supabase
      .from('zone_positions')
      .select('couple_id')
      .eq('zone_id', zoneId)

    if (positionsError) {
      throw new Error('Error al obtener parejas de la zona')
    }

    let coupleCount = zonePositions?.length || 0
    if (coupleCount === 0) {
      const { data: zoneCouples } = await supabase
        .from('zone_couples')
        .select('couple_id')
        .eq('zone_id', zoneId)

      coupleCount = zoneCouples?.length || 0
    }

    let tournament: TournamentLike | null = null
    if (!isPositiveNumber(zone.rounds_per_couple) && zone.tournament_id) {
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('type, format_type, format_config')
        .eq('id', zone.tournament_id)
        .single()

      tournament = tournamentData
    }

    return this.resolveRules({
      tournament,
      zone,
      coupleCount,
    })
  }
}
