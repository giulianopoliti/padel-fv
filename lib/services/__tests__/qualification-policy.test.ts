import { selectQualifiedEntries } from '@/lib/services/qualification-policy.service'
import type { QualifiedEntry } from '@/lib/services/qualification-source.service'

const buildEntries = (zoneSizes: number[]): QualifiedEntry[] => {
  const entries: QualifiedEntry[] = []
  const zones = zoneSizes.map((_, index) => ({
    id: `zone-${index}`,
    letter: String.fromCharCode(65 + index),
  }))
  const maxPosition = Math.max(...zoneSizes)

  for (let localPosition = 1; localPosition <= maxPosition; localPosition++) {
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
      if (localPosition > zoneSizes[zoneIndex]) continue

      const zone = zones[zoneIndex]
      entries.push({
        key: `zone:${zone.id}:${localPosition}`,
        coupleId: `couple-${localPosition}${zone.letter}`,
        zoneId: zone.id,
        localPosition,
        globalPosition: null,
        label: `${localPosition}${zone.letter}`,
        isDefinitive: true,
      })
    }
  }

  return entries
}

describe('qualification-policy', () => {
  it('selects every couple for per-zone ALL in the 13-couple production shape', () => {
    const selected = selectQualifiedEntries(
      buildEntries([4, 3, 3, 3]),
      { kind: 'PER_ZONE_TOP', couplesPerZone: 'ALL' },
      'MAIN'
    )

    expect(selected).toHaveLength(13)
    expect(selected.map((entry) => entry.label)).toEqual([
      '1A', '1B', '1C', '1D',
      '2A', '2B', '2C', '2D',
      '3A', '3B', '3C', '3D',
      '4A',
    ])
  })

  it('selects top 2 per zone without using a global top count', () => {
    const selected = selectQualifiedEntries(
      buildEntries([4, 3, 3, 3]),
      { kind: 'PER_ZONE_TOP', couplesPerZone: 2 },
      'MAIN'
    )

    expect(selected.map((entry) => entry.label)).toEqual([
      '1A', '1B', '1C', '1D',
      '2A', '2B', '2C', '2D',
    ])
  })

  it('selects top 3 per zone and never includes a fourth-place couple', () => {
    const selected = selectQualifiedEntries(
      buildEntries([4, 3, 3, 3]),
      { kind: 'PER_ZONE_TOP', couplesPerZone: 3 },
      'MAIN'
    )

    expect(selected).toHaveLength(12)
    expect(selected.some((entry) => entry.label === '4A')).toBe(false)
  })

  it('keeps legacy global SINGLE slicing for existing configs', () => {
    const selected = selectQualifiedEntries(
      buildEntries([4, 3, 3, 3]),
      { kind: 'SINGLE', advanceCount: 10 },
      'MAIN'
    )

    expect(selected).toHaveLength(10)
    expect(selected.map((entry) => entry.label)).toEqual([
      '1A', '1B', '1C', '1D',
      '2A', '2B', '2C', '2D',
      '3A', '3B',
    ])
  })
})
