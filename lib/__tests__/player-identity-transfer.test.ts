import { hasExternalTournamentHistory, uniqueStrings } from '@/lib/player-identity-transfer'

describe('player identity transfer helpers', () => {
  it('accepts history that belongs entirely to the organizer', () => {
    expect(hasExternalTournamentHistory([
      { id: 'tournament-1', name: 'Apertura', organizationId: 'organization-1' },
      { id: 'tournament-2', name: 'Clausura', organizationId: 'organization-1' },
    ], 'organization-1')).toBe(false)
  })

  it('detects history from another organization or a club-owned tournament', () => {
    expect(hasExternalTournamentHistory([
      { id: 'tournament-1', name: 'Propio', organizationId: 'organization-1' },
      { id: 'tournament-2', name: 'Externo', organizationId: 'organization-2' },
    ], 'organization-1')).toBe(true)

    expect(hasExternalTournamentHistory([
      { id: 'tournament-3', name: 'Torneo de club', organizationId: null },
    ], 'organization-1')).toBe(true)
  })

  it('deduplicates identifiers and removes nullable values', () => {
    expect(uniqueStrings(['a', null, 'a', undefined, 'b'])).toEqual(['a', 'b'])
  })
})
