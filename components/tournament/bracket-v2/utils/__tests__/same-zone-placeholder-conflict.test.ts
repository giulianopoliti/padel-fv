import { detectSameZonePlaceholderConflict } from '../same-zone-placeholder-conflict'
import type { BracketMatchV2, SeedInfo } from '../../types/bracket-types'

const seeds: SeedInfo[] = [
  {
    id: 'seed-a1',
    seed: 1,
    bracket_position: 1,
    couple_id: 'couple-a1',
    zone_id: 'zone-a',
    zone_name: 'Zona A',
    zone_position: 1
  },
  {
    id: 'seed-b1',
    seed: 2,
    bracket_position: 2,
    couple_id: 'couple-b1',
    zone_id: 'zone-b',
    zone_name: 'Zona B',
    zone_position: 1
  }
]

const makeCoupleSlot = (coupleId: string) => ({
  type: 'couple',
  couple: {
    id: coupleId,
    player1_id: 'p1',
    player2_id: 'p2',
    name: `Pareja ${coupleId}`
  }
})

const makePlaceholderSlot = (label: string, zoneId: string, zoneName: string) => ({
  type: 'placeholder',
  placeholder: {
    display: label,
    zoneId,
    zoneName,
    position: 2,
    rule: {
      type: 'zone-position',
      zoneId,
      position: 2
    },
    isDefinitive: false
  }
})

const makeMatch = (slot1: any, slot2: any): BracketMatchV2 => ({
  id: 'match-1',
  round: '4TOS',
  order_in_round: 1,
  status: 'WAITING_OPPONENT',
  participants: {
    slot1,
    slot2
  }
})

describe('detectSameZonePlaceholderConflict', () => {
  it('detects a real couple from Zona A against a Zona A placeholder', () => {
    const result = detectSameZonePlaceholderConflict(
      makeMatch(makeCoupleSlot('couple-a1'), makePlaceholderSlot('2A', 'zone-a', 'Zona A')),
      seeds
    )

    expect(result).toMatchObject({
      coupleId: 'couple-a1',
      placeholderLabel: '2A',
      zoneId: 'zone-a',
      zoneName: 'Zona A'
    })
  })

  it('does not detect a conflict when the placeholder belongs to another zone', () => {
    const result = detectSameZonePlaceholderConflict(
      makeMatch(makeCoupleSlot('couple-a1'), makePlaceholderSlot('2B', 'zone-b', 'Zona B')),
      seeds
    )

    expect(result).toBeNull()
  })

  it('does not replace the real-couple zone-history conflict case', () => {
    const result = detectSameZonePlaceholderConflict(
      makeMatch(makeCoupleSlot('couple-a1'), makeCoupleSlot('couple-b1')),
      seeds
    )

    expect(result).toBeNull()
  })

  it('does not warn when both slots are placeholders', () => {
    const result = detectSameZonePlaceholderConflict(
      makeMatch(
        makePlaceholderSlot('1A', 'zone-a', 'Zona A'),
        makePlaceholderSlot('2A', 'zone-a', 'Zona A')
      ),
      seeds
    )

    expect(result).toBeNull()
  })
})
