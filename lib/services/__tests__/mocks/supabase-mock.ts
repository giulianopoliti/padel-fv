/**
 * SUPABASE MOCK HELPER FOR BRACKET-GENERATOR-V2 TESTS
 *
 * Proporciona funciones helper para crear mocks de datos de Supabase
 * usados en tests del PlaceholderBracketGenerator.
 *
 * @author Claude Code Assistant
 * @created 2025-01-29
 */

export interface MockZone {
  id: string
  name: string
  created_at: string
}

export interface MockZonePosition {
  zone_id: string
  position: number
  couple_id: string | null
  is_definitive: boolean
}

/**
 * Crea mock de zonas con nombres consistentes (Zona A, Zona B, etc.)
 */
export function createMockZones(count: number): MockZone[] {
  const zones: MockZone[] = []

  for (let i = 0; i < count; i++) {
    const letter = String.fromCharCode(65 + i) // A, B, C...
    zones.push({
      id: `zone-${letter.toLowerCase()}-id`,
      name: `Zona ${letter}`,
      created_at: new Date(2025, 0, i + 1).toISOString() // Sequential dates for ordering
    })
  }

  return zones
}

/**
 * Crea mock de posiciones de zona con configuración flexible
 *
 * @param zoneId - ID de la zona
 * @param couplesCount - Cantidad de parejas en esta zona
 * @param definitivePositions - Array de posiciones que son definitivas (ej: [1, 2])
 * @param zoneLetter - Letra de la zona para generar couple_ids (ej: 'A')
 */
export function createMockZonePositions(
  zoneId: string,
  couplesCount: number,
  definitivePositions: number[] = [],
  zoneLetter: string = 'A'
): MockZonePosition[] {
  const positions: MockZonePosition[] = []

  for (let i = 1; i <= couplesCount; i++) {
    const isDefinitive = definitivePositions.includes(i)

    positions.push({
      zone_id: zoneId,
      position: i,
      couple_id: isDefinitive ? `couple-${zoneLetter}${i}` : null,
      is_definitive: isDefinitive
    })
  }

  return positions
}

/**
 * Crea configuración completa de zonas con posiciones
 *
 * @example
 * // Crear 2 zonas: Zona A con 3 parejas, Zona B con 5 parejas
 * const config = createZoneConfiguration([
 *   { couplesCount: 3, definitivePositions: [1] },
 *   { couplesCount: 5, definitivePositions: [1, 2] }
 * ])
 */
export function createZoneConfiguration(
  zonesConfig: Array<{
    couplesCount: number
    definitivePositions?: number[]
  }>
): {
  zones: MockZone[]
  positions: MockZonePosition[]
} {
  const zones = createMockZones(zonesConfig.length)
  const positions: MockZonePosition[] = []

  zonesConfig.forEach((config, index) => {
    const letter = String.fromCharCode(65 + index) // A, B, C...
    const zonePositions = createMockZonePositions(
      zones[index].id,
      config.couplesCount,
      config.definitivePositions || [],
      letter
    )
    positions.push(...zonePositions)
  })

  return { zones, positions }
}

/**
 * Crea un mock completo de Supabase client para testing
 */
export function createSupabaseMock(
  zones: MockZone[],
  positions: MockZonePosition[]
) {
  return {
    from: (table: string) => {
      if (table === 'zones') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: zones,
                error: null
              })
            })
          })
        }
      }

      if (table === 'zone_positions') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({
                data: positions,
                error: null
              })
            })
          })
        }
      }

      if (table === 'tournaments') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'test-tournament', type: 'AMERICAN' },
                error: null
              })
            })
          })
        }
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            single: () => Promise.resolve({ data: null, error: null }),
            in: () => Promise.resolve({ data: [], error: null })
          })
        })
      }
    }
  }
}
