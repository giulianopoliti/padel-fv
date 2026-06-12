import { selectQualifiedEntries } from '@/lib/services/qualification-policy.service'
import {
  filterOutDisqualifiedCouples,
  isValidCompetitiveDisqualification,
  matchInvolvesDisqualifiedCouple,
  toCoupleIdSet,
} from '@/lib/services/tournament-disqualifications'
import type { QualifiedEntry } from '@/lib/services/qualification-source.service'

const entry = (
  coupleId: string,
  position: number,
  label = `#${position}`
): QualifiedEntry => ({
  key: `entry:${coupleId}`,
  coupleId,
  zoneId: null,
  localPosition: null,
  globalPosition: position,
  label,
  isDefinitive: true,
})

describe('tournament disqualifications', () => {
  it('builds active couple id sets from snake_case and camelCase rows', () => {
    expect(toCoupleIdSet([
      { couple_id: 'couple-1' },
      { coupleId: 'couple-2' },
      { couple_id: null },
    ])).toEqual(new Set(['couple-1', 'couple-2']))
  })

  it('filters disqualified couples from ranking/zone entries before qualification cuts', () => {
    const disqualifiedCouples = new Set(['couple-2'])
    const entries = [
      entry('couple-1', 1),
      entry('couple-2', 2),
      entry('couple-3', 3),
      entry('couple-4', 4),
    ]

    const activeEntries = filterOutDisqualifiedCouples(entries, disqualifiedCouples)

    expect(activeEntries.map((item) => item.coupleId)).toEqual(['couple-1', 'couple-3', 'couple-4'])
  })

  it('ignores invalid bracket disqualifications without an associated match for competitive filtering', () => {
    expect(isValidCompetitiveDisqualification({
      id: 'dq-zone',
      tournament_id: 'tournament-1',
      couple_id: 'couple-1',
      player1_id: 'player-1',
      player2_id: 'player-2',
      phase: 'ZONE_PHASE',
      round: 'ZONE',
      zone_id: 'zone-1',
      match_id: null,
      reason: null,
      status: 'ACTIVE',
      metadata: null,
    })).toBe(true)

    expect(isValidCompetitiveDisqualification({
      id: 'dq-bracket-invalid',
      tournament_id: 'tournament-1',
      couple_id: 'couple-2',
      player1_id: 'player-1',
      player2_id: 'player-2',
      phase: 'BRACKET_PHASE',
      round: '8VOS',
      zone_id: null,
      match_id: null,
      reason: null,
      status: 'ACTIVE',
      metadata: null,
    })).toBe(false)
  })

  it('treats ALL advancement as all active couples after disqualification filtering', () => {
    const activeEntries = filterOutDisqualifiedCouples(
      [entry('couple-1', 1), entry('couple-2', 2), entry('couple-3', 3)],
      new Set(['couple-2'])
    )

    const qualified = selectQualifiedEntries(activeEntries, {
      kind: 'PER_ZONE_TOP',
      couplesPerZone: 'ALL',
    })

    expect(qualified.map((item) => item.coupleId)).toEqual(['couple-1', 'couple-3'])
  })

  it('applies top N cuts after removing disqualified couples', () => {
    const activeEntries = filterOutDisqualifiedCouples(
      [entry('couple-1', 1), entry('couple-2', 2), entry('couple-3', 3), entry('couple-4', 4)],
      new Set(['couple-2'])
    )

    const qualified = selectQualifiedEntries(activeEntries, {
      kind: 'SINGLE',
      advanceCount: 2,
    })

    expect(qualified.map((item) => item.coupleId)).toEqual(['couple-1', 'couple-3'])
  })

  it('recognizes canceled matches caused by disqualified couples', () => {
    const disqualifiedCouples = new Set(['couple-2'])

    expect(matchInvolvesDisqualifiedCouple({
      couple1_id: 'couple-1',
      couple2_id: 'couple-2',
    }, disqualifiedCouples)).toBe(true)

    expect(matchInvolvesDisqualifiedCouple({
      couple1_id: 'couple-1',
      couple2_id: 'couple-3',
    }, disqualifiedCouples)).toBe(false)
  })
})
