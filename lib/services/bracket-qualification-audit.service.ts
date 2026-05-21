import { createClientServiceRole } from '@/utils/supabase/server'
import { QualificationSourceService, type QualifiedEntry } from '@/lib/services/qualification-source.service'
import type { BracketKey } from '@/types/tournament-format-v2'

export type BracketQualificationAuditIssueCode =
  | 'PREMATURELY_RESOLVED_SEED'
  | 'COUPLE_ALREADY_RESOLVED_IN_OTHER_SEED'
  | 'EXPECTED_DEFINITIVE_ENTRY_NOT_RESOLVED'
  | 'SEED_ENTRY_MISMATCH'

export interface BracketQualificationAuditIssue {
  code: BracketQualificationAuditIssueCode
  severity: 'warning' | 'error'
  message: string
  seed: number | null
  expectedLabel?: string | null
  expectedCoupleId?: string | null
  actualCoupleId?: string | null
}

export interface BracketQualificationAuditResult {
  tournamentId: string
  bracketKey: BracketKey
  issues: BracketQualificationAuditIssue[]
  expectedEntries: QualifiedEntry[]
}

export interface BracketSeedSnapshot {
  seed: number
  couple_id: string | null
  is_placeholder: boolean | null
  placeholder_label?: string | null
}

export class BracketQualificationAuditService {
  static async auditTournament(
    tournamentId: string,
    options: { bracketKey?: BracketKey } = {}
  ): Promise<BracketQualificationAuditResult> {
    const bracketKey = options.bracketKey || 'MAIN'
    const supabase = await createClientServiceRole()
    const expectedEntries = await QualificationSourceService.getQualifiedEntries(tournamentId, { bracketKey })

    const { data: seeds, error: seedsError } = await supabase
      .from('tournament_couple_seeds')
      .select('seed, couple_id, is_placeholder, placeholder_label, placeholder_position, placeholder_zone_id')
      .eq('tournament_id', tournamentId)
      .eq('bracket_key', bracketKey)
      .order('seed')

    if (seedsError) {
      throw new Error(`Error loading bracket seeds: ${seedsError.message}`)
    }

    const issues = this.auditSeeds(expectedEntries, seeds || [])

    return {
      tournamentId,
      bracketKey,
      issues,
      expectedEntries,
    }
  }

  static auditSeeds(
    expectedEntries: QualifiedEntry[],
    seeds: BracketSeedSnapshot[]
  ): BracketQualificationAuditIssue[] {
    const issues: BracketQualificationAuditIssue[] = []
    const resolvedSeedByCouple = new Map<string, number>()

    for (const seed of seeds) {
      if (seed.couple_id) {
        if (resolvedSeedByCouple.has(seed.couple_id)) {
          issues.push({
            code: 'COUPLE_ALREADY_RESOLVED_IN_OTHER_SEED',
            severity: 'error',
            message: `La pareja ya esta resuelta en otro seed (${resolvedSeedByCouple.get(seed.couple_id)}).`,
            seed: seed.seed,
            actualCoupleId: seed.couple_id,
          })
        } else {
          resolvedSeedByCouple.set(seed.couple_id, seed.seed)
        }
      }
    }

    for (const seed of seeds) {
      const expected = expectedEntries[seed.seed - 1]
      if (!expected) {
        issues.push({
          code: 'SEED_ENTRY_MISMATCH',
          severity: 'warning',
          message: `No hay entrada esperada para el seed ${seed.seed}.`,
          seed: seed.seed,
          actualCoupleId: seed.couple_id,
        })
        continue
      }

      if (!expected.isDefinitive && seed.couple_id) {
        issues.push({
          code: 'PREMATURELY_RESOLVED_SEED',
          severity: 'warning',
          message: `El seed ${seed.seed} esta resuelto, pero ${expected.label} todavia no es definitivo.`,
          seed: seed.seed,
          expectedLabel: expected.label,
          actualCoupleId: seed.couple_id,
        })
      }

      if (expected.isDefinitive && expected.coupleId && seed.is_placeholder) {
        const existingSeed = resolvedSeedByCouple.get(expected.coupleId)
        issues.push({
          code: existingSeed ? 'COUPLE_ALREADY_RESOLVED_IN_OTHER_SEED' : 'EXPECTED_DEFINITIVE_ENTRY_NOT_RESOLVED',
          severity: existingSeed ? 'error' : 'warning',
          message: existingSeed
            ? `La pareja esperada para ${expected.label} ya esta resuelta en el seed ${existingSeed}.`
            : `La entrada ${expected.label} ya es definitiva, pero el seed sigue como placeholder.`,
          seed: seed.seed,
          expectedLabel: expected.label,
          expectedCoupleId: expected.coupleId,
        })
      }

      if (
        expected.isDefinitive &&
        expected.coupleId &&
        seed.couple_id &&
        seed.couple_id !== expected.coupleId
      ) {
        issues.push({
          code: 'SEED_ENTRY_MISMATCH',
          severity: 'error',
          message: `El seed ${seed.seed} tiene una pareja distinta a la esperada para ${expected.label}.`,
          seed: seed.seed,
          expectedLabel: expected.label,
          expectedCoupleId: expected.coupleId,
          actualCoupleId: seed.couple_id,
        })
      }
    }

    return issues
  }
}
