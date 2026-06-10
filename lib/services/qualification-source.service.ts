import { createClient } from '@/utils/supabase/server'
import { StandingsCalculatorService, type StandingEntry } from '@/lib/services/standings-calculator.service'
import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'
import { DefinitivePositionService, type DefinitivePositionResult } from '@/lib/services/definitive-position.service'
import { selectQualifiedEntries } from '@/lib/services/qualification-policy.service'
import type { BracketKey } from '@/types/tournament-format-v2'

export interface QualifiedEntry {
  key: string
  coupleId: string | null
  zoneId: string | null
  localPosition: number | null
  globalPosition: number | null
  label: string
  isDefinitive: boolean
}

const getZoneLetter = (zoneName: string | null | undefined, fallbackIndex: number) => {
  const match = (zoneName || '').match(/([A-Z])$/i)
  return (match?.[1] || String.fromCharCode(65 + fallbackIndex)).toUpperCase()
}

export class QualificationSourceService {
  static async getQualifiedEntries(
    tournamentId: string,
    options: { bracketKey?: BracketKey } = {}
  ): Promise<QualifiedEntry[]> {
    const bracketKey = options.bracketKey || 'MAIN'
    const supabase = await createClient()
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, type, format_type, format_config')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      throw new Error(`Error loading tournament: ${tournamentError?.message || 'Tournament not found'}`)
    }

    const rules = TournamentFormatRulesService.resolve({ tournament })
    const shouldApplyAdvancementLimit = Boolean((tournament as any)?.format_config?.version === 2)

    if (rules.qualificationSource === 'GLOBAL_STANDINGS') {
      const entries = await this.getGlobalStandingEntries(tournamentId, rules)
      return shouldApplyAdvancementLimit
        ? selectQualifiedEntries(entries, rules.resolvedFormat.effectiveAdvancementConfig, bracketKey)
        : entries
    }

    const entries = await this.getZonePositionEntries(tournamentId)
    return shouldApplyAdvancementLimit
      ? selectQualifiedEntries(entries, rules.resolvedFormat.effectiveAdvancementConfig, bracketKey)
      : entries
  }

  private static async getZonePositionEntries(tournamentId: string): Promise<QualifiedEntry[]> {
    const supabase = await createClient()
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('created_at')

    if (zonesError) {
      throw new Error(`Error loading zones: ${zonesError.message}`)
    }

    const zoneIds = (zones || []).map((zone) => zone.id)
    if (zoneIds.length === 0) return []

    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select('zone_id, position, couple_id, is_definitive')
      .in('zone_id', zoneIds)
      .order('position')

    if (positionsError) {
      throw new Error(`Error loading zone positions: ${positionsError.message}`)
    }

    return this.buildZonePositionEntries(zones || [], positions || [])
  }

  static buildZonePositionEntries(
    zones: Array<{ id: string; name?: string | null }>,
    positions: Array<{ zone_id: string; position: number; couple_id: string | null; is_definitive: boolean | null }>
  ): QualifiedEntry[] {
    const zoneIndex = new Map(zones.map((zone, index) => [zone.id, { ...zone, index }]))
    const maxPosition = Math.max(0, ...positions.map((position) => position.position || 0))
    const entries: QualifiedEntry[] = []

    for (let localPosition = 1; localPosition <= maxPosition; localPosition++) {
      for (const zone of zones) {
        const position = positions.find((item) => (
          item.zone_id === zone.id && item.position === localPosition
        ))
        if (!position) continue

        const zoneInfo = zoneIndex.get(zone.id)
        const letter = getZoneLetter(zone.name, zoneInfo?.index || 0)
        const label = `${localPosition}${letter}`

        entries.push({
          key: `zone:${zone.id}:${localPosition}`,
          coupleId: position.is_definitive ? position.couple_id : null,
          zoneId: zone.id,
          localPosition,
          globalPosition: null,
          label,
          isDefinitive: Boolean(position.is_definitive && position.couple_id),
        })
      }
    }

    return entries
  }

  static buildGlobalStandingEntries(
    standingsEntries: StandingEntry[],
    definitiveResult: DefinitivePositionResult
  ): QualifiedEntry[] {
    const definitiveByCouple = new Map<string, boolean>()
    for (const zoneResult of definitiveResult.zoneResults) {
      for (const analysis of zoneResult.analysis) {
        definitiveByCouple.set(analysis.coupleId, analysis.isDefinitive)
      }
    }

    return standingsEntries.map((entry) => {
      const position = entry.globalPosition || 0
      const isDefinitive = Boolean(definitiveByCouple.get(entry.coupleId))

      return {
        key: `global:${position}`,
        coupleId: isDefinitive ? entry.coupleId : null,
        zoneId: null,
        localPosition: null,
        globalPosition: position,
        label: `#${position} general`,
        isDefinitive,
      }
    })
  }

  private static async getGlobalStandingEntries(
    tournamentId: string,
    rules: ReturnType<typeof TournamentFormatRulesService.resolve>
  ): Promise<QualifiedEntry[]> {
    const [standings, definitives] = await Promise.all([
      StandingsCalculatorService.calculate({
        tournamentId,
        scope: 'GLOBAL',
        rankingPolicyId: rules.rankingPolicyId,
      }),
      DefinitivePositionService.analyzeTournament(tournamentId),
    ])

    return this.buildGlobalStandingEntries(standings.entries, definitives)
  }

}
