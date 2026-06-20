import { PLAYER_INSCRIPTION_COPY } from '@/lib/tournaments/player-inscription-copy'

describe('player inscription copy', () => {
  it('uses the agreed pending and confirmed messages', () => {
    expect(PLAYER_INSCRIPTION_COPY.pendingTitle).toBe('Tu inscripción está pendiente')
    expect(PLAYER_INSCRIPTION_COPY.confirmedTitle).toBe('Ya estás inscripto')
  })
})
