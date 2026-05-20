import {
  filterOutDisqualifiedCouples,
  toIdSet,
} from '@/lib/services/tournament-disqualifications'

describe('tournament disqualification helpers', () => {
  it('AMERICAN: shifts bracket candidates by skipping a disqualified global seed', () => {
    const rankedCouples = [
      { couple_id: 'seed-1' },
      { couple_id: 'seed-2' },
      { couple_id: 'seed-3' },
      { couple_id: 'seed-4' },
      { couple_id: 'seed-5' },
      { couple_id: 'seed-6' },
      { couple_id: 'seed-7' },
      { couple_id: 'seed-8' },
    ]

    const filtered = filterOutDisqualifiedCouples(rankedCouples, new Set(['seed-7']))

    expect(filtered.map((row) => row.couple_id)).toEqual([
      'seed-1',
      'seed-2',
      'seed-3',
      'seed-4',
      'seed-5',
      'seed-6',
      'seed-8',
    ])
    expect(filtered[6].couple_id).toBe('seed-8')
  })

  it('AMERICAN: preserves by-zone ordering while skipping only disqualified couples', () => {
    const byZoneOrder = [
      { couple_id: '1A', position: 1, zone: 'A' },
      { couple_id: '1B', position: 1, zone: 'B' },
      { couple_id: '2A', position: 2, zone: 'A' },
      { couple_id: '2B', position: 2, zone: 'B' },
      { couple_id: '3A', position: 3, zone: 'A' },
      { couple_id: '3B', position: 3, zone: 'B' },
    ]

    const filtered = filterOutDisqualifiedCouples(byZoneOrder, new Set(['2A']))

    expect(filtered.map((row) => row.couple_id)).toEqual(['1A', '1B', '2B', '3A', '3B'])
  })

  it('LONG: excludes a disqualified couple from the current single-zone ranking', () => {
    const currentZonePositions = [
      { couple_id: 'long-1', position: 1, is_definitive: false },
      { couple_id: 'long-2', position: 2, is_definitive: false },
      { couple_id: 'long-3', position: 3, is_definitive: false },
    ]

    const filtered = filterOutDisqualifiedCouples(currentZonePositions, new Set(['long-2']))

    expect(filtered.map((row) => row.couple_id)).toEqual(['long-1', 'long-3'])
  })

  it('builds an id set from active disqualification rows', () => {
    expect(toIdSet([{ couple_id: 'a' }, { couple_id: null }, { couple_id: 'b' }])).toEqual(
      new Set(['a', 'b'])
    )
  })
})
