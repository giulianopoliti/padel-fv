import { getLongNavigationItems } from '../TournamentLongSidebar'

describe('LONG player navigation', () => {
  it('shows only the primary player destinations', () => {
    const titles = getLongNavigationItems('PLAYER', false, true).map(item => item.title)

    expect(titles).toEqual(['Inicio', 'Cargar disponibilidad', 'Tablas de posiciones', 'Llave'])
    expect(titles).not.toContain('Encuentros de qually')
    expect(titles).not.toContain('Inscripciones')
  })

  it('removes availability after elimination', () => {
    const titles = getLongNavigationItems('PLAYER', true, true).map(item => item.title)

    expect(titles).toEqual(['Inicio', 'Tablas de posiciones', 'Llave'])
  })

  it('removes availability while approval is pending', () => {
    const titles = getLongNavigationItems('PLAYER', false, true, true).map(item => item.title)

    expect(titles).toEqual(['Inicio', 'Tablas de posiciones', 'Llave'])
  })

  it('keeps management tools for organizers', () => {
    const titles = getLongNavigationItems('ORGANIZADOR', false, true).map(item => item.title)

    expect(titles).toContain('Encuentros de qually')
    expect(titles).toContain('Inscripciones')
    expect(titles).toContain('Configuración')
  })
})
