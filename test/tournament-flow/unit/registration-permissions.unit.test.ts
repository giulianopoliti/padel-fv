import { AmericanTournamentStrategy } from '@/lib/services/registration/american-tournament-strategy'
import { LongTournamentStrategy } from '@/lib/services/registration/long-tournament-strategy'

const context = {
  tournament: {
    id: 'tournament-1',
    name: 'Test',
    type: 'LONG' as const,
    gender: 'MALE' as const,
    status: 'NOT_STARTED',
  },
  user: { id: 'user-1' },
  supabase: {},
}

describe.each([
  ['LONG', () => new LongTournamentStrategy()],
  ['AMERICAN', () => new AmericanTournamentStrategy()],
])('%s registration authorization', (_type, createStrategy) => {
  it('rejects a forged organizer registration flag', async () => {
    const strategy = createStrategy()
    jest.spyOn(strategy as any, 'validateCoupleRegistration').mockResolvedValue({ isValid: true })
    jest.spyOn(strategy as any, 'checkRegistrationPermissions').mockResolvedValue({
      success: true,
      isOrganizer: false,
    })

    const result = await strategy.registerCouple({
      tournamentId: 'tournament-1',
      player1Id: 'player-1',
      player2Id: 'player-2',
      isOrganizerRegistration: true,
    }, context as any)

    expect(result).toEqual({
      success: false,
      error: 'No tiene permisos para registrar como organizador.',
    })
  })

  it('detects a player stored as the second member of an existing couple', async () => {
    const strategy = createStrategy() as any
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockResolvedValue({
        data: [{
          couples: {
            player1_id: 'another-player',
            player2_id: 'player-2',
          },
        }],
        error: null,
      }),
    }
    const supabase = { from: jest.fn().mockReturnValue(query) }

    const result = await strategy.checkExistingPlayerInscriptions(
      'player-1',
      'player-2',
      'tournament-1',
      supabase
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('inscrito')
  })
})
