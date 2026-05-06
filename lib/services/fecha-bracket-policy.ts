import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'

export type FechaRoundType = 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL'
export type FechaBracketKey = 'MAIN' | 'GOLD' | 'SILVER'

const VALID_FECHA_BRACKET_KEYS: readonly FechaBracketKey[] = ['MAIN', 'GOLD', 'SILVER'] as const

export function isFechaBracketKey(value: string | null | undefined): value is FechaBracketKey {
  return VALID_FECHA_BRACKET_KEYS.includes(value as FechaBracketKey)
}

export function getFechaBracketLabel(bracketKey: FechaBracketKey): string {
  if (bracketKey === 'GOLD') return 'Copa de Oro'
  if (bracketKey === 'SILVER') return 'Copa de Plata'
  return 'Principal'
}

type TournamentLike = {
  type?: string | null
  format_config?: unknown
}

interface ResolveFechaBracketKeyInput {
  roundType: FechaRoundType
  requestedBracketKey?: string | null
}

export interface ResolveFechaBracketKeyResult {
  ok: boolean
  bracketKey: FechaBracketKey
  error?: string
}

export function resolveFechaBracketKeyForTournament(
  tournament: TournamentLike,
  input: ResolveFechaBracketKeyInput
): ResolveFechaBracketKeyResult {
  const requestedBracketKey = isFechaBracketKey(input.requestedBracketKey)
    ? input.requestedBracketKey
    : undefined

  if (input.roundType === 'ZONE') {
    if (requestedBracketKey && requestedBracketKey !== 'MAIN') {
      return {
        ok: false,
        bracketKey: 'MAIN',
        error: 'La ronda ZONE solo admite llave Principal.',
      }
    }

    return {
      ok: true,
      bracketKey: 'MAIN',
    }
  }

  const resolved = TournamentFormatResolver.getResolvedFormat(tournament)
  const isLongGoldSilver =
    tournament.type === 'LONG' && resolved.effectiveBracketMode === 'GOLD_SILVER'

  if (isLongGoldSilver) {
    if (!requestedBracketKey || requestedBracketKey === 'MAIN') {
      return {
        ok: false,
        bracketKey: 'MAIN',
        error: 'Para llaves LONG Oro/Plata, debes seleccionar Copa de Oro o Copa de Plata.',
      }
    }

    return {
      ok: true,
      bracketKey: requestedBracketKey,
    }
  }

  if (requestedBracketKey && requestedBracketKey !== 'MAIN') {
    return {
      ok: false,
      bracketKey: 'MAIN',
      error: 'Este torneo no admite separación por copa en fechas. Usa llave Principal.',
    }
  }

  return {
    ok: true,
    bracketKey: 'MAIN',
  }
}
