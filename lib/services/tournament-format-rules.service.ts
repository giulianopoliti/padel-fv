import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import { TournamentConfigService } from '@/lib/services/tournament-config.service'
import { getZonesFormatIdFromTournament } from '@/lib/services/zones-format-utils'
import { getZoneStageAndMatchesPerCouple } from '@/lib/services/zone-fixture-planner.service'
import type {
  BracketSeedingStrategy,
  QualificationSource,
  RankingPolicyId,
  RankingScope,
  ResolvedTournamentFormat,
} from '@/types/tournament-format-v2'

export type TournamentRulesSource =
  | 'tournament.format_config'
  | 'legacy.format_type'
  | 'fallback'

export interface TournamentRulesInput {
  tournament: {
    type?: string | null
    format_type?: string | null
    format_config?: unknown
  }
  zone?: {
    rounds_per_couple?: number | null
  } | null
  coupleCount?: number
}

export interface ResolvedTournamentRules {
  resolvedFormat: ResolvedTournamentFormat
  matchesPerCouple: number
  rankingScope: RankingScope
  rankingPolicyId: RankingPolicyId
  qualificationSource: QualificationSource
  bracketSeedingStrategy: BracketSeedingStrategy
  source: TournamentRulesSource
}

const hasFormatConfigV2 = (tournament: TournamentRulesInput['tournament']) => (
  Boolean((tournament as any)?.format_config?.version === 2)
)

const isPositiveNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
)

export class TournamentFormatRulesService {
  static resolve(input: TournamentRulesInput): ResolvedTournamentRules {
    const coupleCount = input.coupleCount || 0
    const resolvedFormat = TournamentFormatResolver.getResolvedFormat(
      input.tournament,
      { totalCouples: coupleCount }
    )

    let matchesPerCouple = input.zone?.rounds_per_couple || 0
    let source: TournamentRulesSource = 'fallback'

    if (isPositiveNumber(matchesPerCouple)) {
      source = 'tournament.format_config'
    } else if (hasFormatConfigV2(input.tournament)) {
      matchesPerCouple = getZoneStageAndMatchesPerCouple(coupleCount, resolvedFormat).matchesPerCouple
      source = 'tournament.format_config'
    } else {
      const legacyFormatId = getZonesFormatIdFromTournament(input.tournament, { totalCouples: coupleCount })
      matchesPerCouple = TournamentConfigService.getMatchesPerCouple(legacyFormatId, coupleCount)
      source = 'legacy.format_type'
    }

    if (!isPositiveNumber(matchesPerCouple)) {
      matchesPerCouple = coupleCount > 0 ? Math.max(1, Math.min(coupleCount - 1, 2)) : 0
      source = 'fallback'
    }

    return {
      resolvedFormat,
      matchesPerCouple,
      rankingScope: resolvedFormat.rankingScope,
      rankingPolicyId: resolvedFormat.rankingPolicyId,
      qualificationSource: resolvedFormat.qualificationSource,
      bracketSeedingStrategy: resolvedFormat.bracketSeedingStrategy,
      source,
    }
  }
}
