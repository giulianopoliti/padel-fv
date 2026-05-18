import {
  canAccessPrivateParticipantPages,
  canViewTournamentParticipantPages,
  canViewTournamentParticipantPagesFromFlags,
} from '../tournament-visibility'

describe('tournament participant visibility', () => {
  it('allows private participant pages for full management and active players', () => {
    expect(canAccessPrivateParticipantPages('FULL_MANAGEMENT')).toBe(true)
    expect(canAccessPrivateParticipantPages('PLAYER_ACTIVE')).toBe(true)
    expect(canAccessPrivateParticipantPages('PLAYER_ELIMINATED')).toBe(false)
    expect(canAccessPrivateParticipantPages('PUBLIC_VIEW')).toBe(false)
  })

  it('shows participant pages when public inscriptions are enabled', () => {
    expect(
      canViewTournamentParticipantPages({
        enablePublicInscriptions: true,
        accessLevel: 'PUBLIC_VIEW',
      })
    ).toBe(true)
  })

  it('hides participant pages when inscriptions are private and access is public', () => {
    expect(
      canViewTournamentParticipantPages({
        enablePublicInscriptions: false,
        accessLevel: 'PUBLIC_VIEW',
      })
    ).toBe(false)
  })

  it('reuses the same rule from client-side flags', () => {
    expect(
      canViewTournamentParticipantPagesFromFlags({
        enablePublicInscriptions: false,
        hasManagementPermission: true,
      })
    ).toBe(true)

    expect(
      canViewTournamentParticipantPagesFromFlags({
        enablePublicInscriptions: false,
        hasActivePlayerInscription: true,
      })
    ).toBe(true)

    expect(
      canViewTournamentParticipantPagesFromFlags({
        enablePublicInscriptions: false,
      })
    ).toBe(false)
  })
})
