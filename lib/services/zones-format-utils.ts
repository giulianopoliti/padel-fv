import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import type { ResolvedTournamentFormat } from '@/types/tournament-format-v2'

export type ZonesFormatId = 'AMERICAN_2' | 'AMERICAN_3' | 'LONG'

export function getZonesFormatIdFromResolvedFormat(
  resolved: ResolvedTournamentFormat
): ZonesFormatId {
  if (resolved.baseType === 'LONG') {
    return 'LONG'
  }

  return resolved.effectiveTargetMatchesPerCouple === 3 ? 'AMERICAN_3' : 'AMERICAN_2'
}

export function getZonesFormatIdFromTournament(
  tournament: {
    type?: string | null
    format_type?: string | null
    format_config?: unknown
  },
  options: {
    totalCouples?: number
  } = {}
): ZonesFormatId {
  const resolved = TournamentFormatResolver.getResolvedFormat(tournament, options)
  return getZonesFormatIdFromResolvedFormat(resolved)
}
