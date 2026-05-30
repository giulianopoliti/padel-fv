import { transformZoneData } from '@/components/tournament/zones/utils/data-serialization'

describe('tournament flow unit: zone data serialization', () => {
  it('preserves max_couples separately from current capacity', () => {
    const zone = transformZoneData({
      id: 'zone-1',
      name: 'Zona C',
      capacity: 2,
      max_couples: 4,
      created_at: '2026-05-30T23:10:59.935Z',
      couples: [{ id: 'couple-1' }, { id: 'couple-2' }],
    })

    expect(zone.capacity).toBe(2)
    expect(zone.maxCouples).toBe(4)
  })
})
