import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { BracketQualificationAuditService } from '@/lib/services/bracket-qualification-audit.service'
import { DefinitivePositionService } from '@/lib/services/definitive-position.service'
import { QualificationSourceService } from '@/lib/services/qualification-source.service'
import { StandingsCalculatorService, type StandingsSnapshot } from '@/lib/services/standings-calculator.service'
import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'

const couple = (id: string, zoneId: string) => ({
  id,
  zoneId,
  player1_id: `${id}-p1`,
  player2_id: `${id}-p2`,
  player1: { id: `${id}-p1`, first_name: id, last_name: 'A', score: 1 },
  player2: { id: `${id}-p2`, first_name: id, last_name: 'B', score: 1 },
})

const match = (
  id: string,
  zoneId: string,
  couple1Id: string,
  couple2Id: string,
  result1: number | null,
  result2: number | null,
  winnerId: string | null,
  status = 'FINISHED'
) => ({
  id,
  zone_id: zoneId,
  couple1_id: couple1Id,
  couple2_id: couple2Id,
  result_couple1: result1,
  result_couple2: result2,
  winner_id: winnerId,
  status,
})

describe('ranking scalability services', () => {
  it('resolves format-aware tournament rules for operational presets', () => {
    const american2 = TournamentFormatRulesService.resolve({
      tournament: { format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2') },
      coupleCount: 4,
    })
    const american3 = TournamentFormatRulesService.resolve({
      tournament: { format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3') },
      coupleCount: 4,
    })
    const americanGlobal2 = TournamentFormatRulesService.resolve({
      tournament: { format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_GLOBAL_2') },
      coupleCount: 4,
    })
    const americanGlobal3 = TournamentFormatRulesService.resolve({
      tournament: { format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_GLOBAL_3') },
      coupleCount: 4,
    })
    const longGoldSilver = TournamentFormatRulesService.resolve({
      tournament: { format_config: getTournamentFormatPreset('LONG_SINGLE_ZONE_GOLD_SILVER') },
      coupleCount: 4,
    })

    expect(american2.matchesPerCouple).toBe(2)
    expect(american3.matchesPerCouple).toBe(3)
    expect(americanGlobal2.matchesPerCouple).toBe(2)
    expect(americanGlobal3.matchesPerCouple).toBe(3)
    expect(americanGlobal2.rankingScope).toBe('GLOBAL')
    expect(americanGlobal2.qualificationSource).toBe('GLOBAL_STANDINGS')
    expect(americanGlobal2.bracketSeedingStrategy).toBe('GLOBAL_RANKING')
    expect(longGoldSilver.rankingScope).toBe('PER_ZONE')
    expect(longGoldSilver.qualificationSource).toBe('ZONE_POSITIONS')
    expect(longGoldSilver.bracketSeedingStrategy).toBe('SERPENTINE_BY_ZONE')
  })

  it('calculates per-zone and global standings with the same ranking engine', () => {
    const snapshot: StandingsSnapshot = {
      zones: [{ id: 'zone-a', name: 'Zona A' }, { id: 'zone-b', name: 'Zona B' }],
      couples: [
        couple('a1', 'zone-a'),
        couple('a2', 'zone-a'),
        couple('b1', 'zone-b'),
        couple('b2', 'zone-b'),
      ],
      matches: [
        match('m1', 'zone-a', 'a1', 'a2', 6, 4, 'a1'),
        match('m2', 'zone-b', 'b1', 'b2', 6, 0, 'b1'),
      ],
    }

    const perZone = StandingsCalculatorService.calculateFromSnapshot(snapshot, {
      scope: 'PER_ZONE',
      rankingPolicyId: 'STANDARD_PADEL',
    })
    const global = StandingsCalculatorService.calculateFromSnapshot(snapshot, {
      scope: 'GLOBAL',
      rankingPolicyId: 'STANDARD_PADEL',
    })

    expect(perZone.entries.find((entry) => entry.coupleId === 'a1')?.localPosition).toBe(1)
    expect(perZone.entries.find((entry) => entry.coupleId === 'b1')?.localPosition).toBe(1)
    expect(global.entries[0].coupleId).toBe('b1')
  })

  it('builds global qualification entries with global placeholders and definitive couples', () => {
    const snapshot: StandingsSnapshot = {
      zones: [{ id: 'zone-a', name: 'Zona A' }, { id: 'zone-b', name: 'Zona B' }],
      couples: [
        couple('a1', 'zone-a'),
        couple('a2', 'zone-a'),
        couple('b1', 'zone-b'),
        couple('b2', 'zone-b'),
      ],
      matches: [
        match('m1', 'zone-a', 'a1', 'a2', 6, 4, 'a1'),
        match('m2', 'zone-b', 'b1', 'b2', 6, 0, 'b1'),
      ],
    }

    const global = StandingsCalculatorService.calculateFromSnapshot(snapshot, {
      scope: 'GLOBAL',
      rankingPolicyId: 'STANDARD_PADEL',
    })
    const entries = QualificationSourceService.buildGlobalStandingEntries(global.entries, {
      scope: 'GLOBAL',
      zoneResults: [
        {
          zoneId: 'zone-a',
          totalCouples: 2,
          definitivePositions: 1,
          totalComputationTime: 0,
          optimizationsApplied: [],
          analysis: [
            {
              coupleId: 'a1',
              currentPosition: 2,
              isDefinitive: false,
              possiblePositions: [1, 2],
              analysisMethod: 'BACKTRACKING',
              analysisDetails: '',
              confidence: 'HIGH',
              computationTime: 0,
            },
          ],
        },
        {
          zoneId: 'zone-b',
          totalCouples: 2,
          definitivePositions: 1,
          totalComputationTime: 0,
          optimizationsApplied: [],
          analysis: [
            {
              coupleId: 'b1',
              currentPosition: 1,
              isDefinitive: true,
              possiblePositions: [1],
              analysisMethod: 'NO_PENDING_MATCHES',
              analysisDetails: '',
              confidence: 'HIGH',
              computationTime: 0,
            },
          ],
        },
      ],
    })

    expect(entries[0]).toEqual(expect.objectContaining({
      label: '#1 general',
      coupleId: 'b1',
      globalPosition: 1,
      localPosition: null,
      zoneId: null,
      isDefinitive: true,
    }))
    expect(entries[1]).toEqual(expect.objectContaining({
      label: '#2 general',
      coupleId: null,
      globalPosition: 2,
      localPosition: null,
      zoneId: null,
      isDefinitive: false,
    }))
  })

  it('does not mark an AMERICAN 3 0W-2L couple definitive while it has a pending match', () => {
    const snapshot: StandingsSnapshot = {
      zones: [{ id: 'zone-a', name: 'Zona A' }],
      couples: [
        couple('ammirato', 'zone-a'),
        couple('lopez', 'zone-a'),
        couple('ballestero', 'zone-a'),
        couple('campana', 'zone-a'),
      ],
      matches: [
        match('m1', 'zone-a', 'ammirato', 'ballestero', 6, 0, 'ammirato'),
        match('m2', 'zone-a', 'ballestero', 'campana', 6, 3, 'ballestero'),
        match('m3', 'zone-a', 'ammirato', 'lopez', 6, 3, 'ammirato'),
        match('m4', 'zone-a', 'lopez', 'ballestero', 6, 3, 'lopez'),
        match('m5', 'zone-a', 'ammirato', 'campana', 6, 2, 'ammirato'),
        match('m6', 'zone-a', 'lopez', 'campana', null, null, null, 'IN_PROGRESS'),
      ],
    }

    const result = DefinitivePositionService.analyzeFromSnapshot({
      snapshot,
      scope: 'PER_ZONE',
      rankingPolicyId: 'STANDARD_PADEL',
    })
    const zone = result.zoneResults[0]
    const campana = zone.analysis.find((entry) => entry.coupleId === 'campana')

    expect(campana?.isDefinitive).toBe(false)
    expect(campana?.possiblePositions).toEqual(expect.arrayContaining([2, 3, 4]))
  })

  it('keeps PER_ZONE isolated but lets GLOBAL pending matches affect other zones', () => {
    const snapshot: StandingsSnapshot = {
      zones: [{ id: 'zone-a', name: 'Zona A' }, { id: 'zone-b', name: 'Zona B' }],
      couples: [
        couple('a1', 'zone-a'),
        couple('a2', 'zone-a'),
        couple('b1', 'zone-b'),
        couple('b2', 'zone-b'),
      ],
      matches: [
        match('m1', 'zone-a', 'a1', 'a2', 6, 0, 'a1'),
        match('m2', 'zone-b', 'b1', 'b2', null, null, null, 'PENDING'),
      ],
    }

    const perZone = DefinitivePositionService.analyzeFromSnapshot({
      snapshot,
      scope: 'PER_ZONE',
      rankingPolicyId: 'STANDARD_PADEL',
      zoneId: 'zone-a',
    })
    const global = DefinitivePositionService.analyzeFromSnapshot({
      snapshot,
      scope: 'GLOBAL',
      rankingPolicyId: 'STANDARD_PADEL',
    })

    expect(perZone.zoneResults[0].analysis.every((entry) => entry.isDefinitive)).toBe(true)
    expect(global.zoneResults.flatMap((zone) => zone.analysis).some((entry) => !entry.isDefinitive)).toBe(true)
  })

  it('builds zone qualification entries without a hardcoded max position', () => {
    const entries = QualificationSourceService.buildZonePositionEntries(
      [{ id: 'zone-a', name: 'Zona A' }, { id: 'zone-b', name: 'Zona B' }],
      [
        { zone_id: 'zone-a', position: 1, couple_id: 'a1', is_definitive: true },
        { zone_id: 'zone-b', position: 1, couple_id: 'b1', is_definitive: true },
        { zone_id: 'zone-a', position: 5, couple_id: 'a5', is_definitive: false },
      ]
    )

    expect(entries.map((entry) => entry.label)).toEqual(['1A', '1B', '5A'])
    expect(entries.find((entry) => entry.label === '5A')?.coupleId).toBeNull()
  })

  it('audits bracket qualification inconsistencies without mutating seeds', () => {
    const issues = BracketQualificationAuditService.auditSeeds(
      [
        { key: 'zone:a:3', coupleId: null, zoneId: 'zone-a', localPosition: 3, globalPosition: null, label: '3A', isDefinitive: false },
        { key: 'zone:a:4', coupleId: null, zoneId: 'zone-a', localPosition: 4, globalPosition: null, label: '4A', isDefinitive: false },
      ],
      [
        { seed: 1, couple_id: null, is_placeholder: true, placeholder_label: '3A' },
        { seed: 2, couple_id: 'campana', is_placeholder: false, placeholder_label: null },
      ]
    )

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PREMATURELY_RESOLVED_SEED',
        seed: 2,
        actualCoupleId: 'campana',
      }),
    ]))
  })
})
