import type { BracketKey, ResolvedTournamentFormat } from '@/types/tournament-format-v2'

export const DEFAULT_BRACKET_KEY: BracketKey = 'MAIN'

export const OPERATIONAL_BRACKET_KEYS: readonly BracketKey[] = ['MAIN', 'GOLD', 'SILVER'] as const

export function isBracketKey(value: string | null | undefined): value is BracketKey {
  return value === 'MAIN' || value === 'GOLD' || value === 'SILVER'
}

export function normalizeBracketKey(value: string | null | undefined): BracketKey {
  if (isBracketKey(value)) {
    return value
  }
  return DEFAULT_BRACKET_KEY
}

export function getOperationalBracketKeysForFormat(
  resolved: Pick<ResolvedTournamentFormat, 'effectiveBracketMode'>
): BracketKey[] {
  if (resolved.effectiveBracketMode === 'GOLD_SILVER') {
    return ['GOLD', 'SILVER']
  }
  return [DEFAULT_BRACKET_KEY]
}

export function getBracketLabelByKey(bracketKey: BracketKey): string {
  if (bracketKey === 'GOLD') return 'Copa de Oro'
  if (bracketKey === 'SILVER') return 'Copa de Plata'
  return 'Llave Principal'
}
