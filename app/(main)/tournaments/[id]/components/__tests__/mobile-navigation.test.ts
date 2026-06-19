import { getMobileTournamentNavigationItems } from '../TournamentMobileBottomNav'

describe('LONG mobile navigation', () => {
  it('shows availability for an active player', () => {
    const labels = getMobileTournamentNavigationItems('tournament-1', 'PLAYER', true).map(item => item.label)
    expect(labels).toEqual(['Inicio', 'Disponibilidad', 'Tablas', 'Llave'])
  })

  it('hides availability for an eliminated or pending player', () => {
    const labels = getMobileTournamentNavigationItems('tournament-1', 'PLAYER', false).map(item => item.label)
    expect(labels).toEqual(['Inicio', 'Tablas', 'Llave'])
  })

  it('provides organizer shortcuts without player standings', () => {
    const items = getMobileTournamentNavigationItems('tournament-1', 'ORGANIZER', true)
    expect(items.map(item => item.label)).toEqual(['Inicio', 'Horarios', 'Partidos', 'Llave'])
    expect(items[2].href).toBe('/tournaments/tournament-1/match-scheduling')
  })
})
