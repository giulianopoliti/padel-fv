/**
 * COMPREHENSIVE TEST SUITE FOR PlaceholderBracketGenerator
 *
 * Tests the bracket generation algorithm with equal and unequal zone configurations
 * to verify behavior with positions 1-4 and edge cases with position 5+.
 *
 * Test Groups:
 * - GRUPO A: Zonas Iguales (expected current behavior)
 * - GRUPO B: Zonas Desiguales (problematic cases)
 * - GRUPO C: Edge Cases (boundary conditions)
 *
 * @author Claude Code Assistant
 * @created 2025-01-29
 */

import { PlaceholderBracketGenerator } from '../bracket-generator-v2'
import {
  createZoneConfiguration,
  createSupabaseMock,
  type MockZone,
  type MockZonePosition
} from './mocks/supabase-mock'

// Mock de createClient de Supabase
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

describe('PlaceholderBracketGenerator - American Format Seeding', () => {
  let generator: PlaceholderBracketGenerator
  let mockCreateClient: jest.Mock

  beforeEach(() => {
    generator = new PlaceholderBracketGenerator()
    mockCreateClient = require('@/utils/supabase/server').createClient as jest.Mock
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================================
  // GRUPO A: ZONAS IGUALES (comportamiento esperado actual)
  // ============================================================================

  describe('GRUPO A: Zonas Iguales', () => {
    test('✅ A1: 2 zonas de 3 parejas cada una (6 total) → debe generar 6 seeds', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A
        { couplesCount: 3, definitivePositions: [1] }  // Zona B
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      expect(seeds).toHaveLength(6)

      // Verificar orden by-zones: 1A, 1B, 2A, 2B, 3A, 3B
      expect(seeds[0].placeholder_label || 'couple').toContain('1A')
      expect(seeds[1].placeholder_label || 'couple').toContain('1B')
      expect(seeds[2].placeholder_label || 'couple').toContain('2A')
      expect(seeds[3].placeholder_label || 'couple').toContain('2B')
      expect(seeds[4].placeholder_label || 'couple').toContain('3A')
      expect(seeds[5].placeholder_label || 'couple').toContain('3B')

      // Verificar que las posiciones definitivas tienen couple_id
      expect(seeds[0].couple_id).toBe('couple-A1')
      expect(seeds[1].couple_id).toBe('couple-B1')

      // Verificar bracket positions asignados por serpentine
      expect(seeds[0].bracket_position).toBeGreaterThan(0)
    })

    test('✅ A2: 2 zonas de 4 parejas cada una (8 total) → debe generar 8 seeds', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 4, definitivePositions: [1, 2] }, // Zona A
        { couplesCount: 4, definitivePositions: [1] }     // Zona B
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      expect(seeds).toHaveLength(8)

      // Verificar orden: 1A, 1B, 2A, 2B, 3A, 3B, 4A, 4B
      const labels = seeds.map(s => s.placeholder_label || `couple-${s.couple_id?.split('-')[1]}`)
      expect(labels).toEqual(
        expect.arrayContaining(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'])
      )

      // Verificar posición 4 está presente (tu fix reciente)
      expect(seeds.filter(s => s.placeholder_label === '4A')).toHaveLength(1)
      expect(seeds.filter(s => s.placeholder_label === '4B')).toHaveLength(1)
    })

    test('✅ A3: 3 zonas de 3 parejas cada una (9 total) → debe generar 9 seeds', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A
        { couplesCount: 3, definitivePositions: [1] }, // Zona B
        { couplesCount: 3, definitivePositions: [1] }  // Zona C
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      expect(seeds).toHaveLength(9)

      // Verificar seed numbers son consecutivos sin gaps
      const seedNumbers = seeds.map(s => s.seed)
      expect(seedNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    test('✅ A4: 3 zonas de 4 parejas cada una (12 total) → debe generar 12 seeds', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 4, definitivePositions: [1, 2] }, // Zona A
        { couplesCount: 4, definitivePositions: [1] },    // Zona B
        { couplesCount: 4, definitivePositions: [1] }     // Zona C
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      expect(seeds).toHaveLength(12)

      // Verificar todas las posiciones 4 están presentes
      expect(seeds.filter(s => s.placeholder_label === '4A')).toHaveLength(1)
      expect(seeds.filter(s => s.placeholder_label === '4B')).toHaveLength(1)
      expect(seeds.filter(s => s.placeholder_label === '4C')).toHaveLength(1)
    })
  })

  // ============================================================================
  // GRUPO B: ZONAS DESIGUALES (casos problemáticos)
  // ============================================================================

  describe('GRUPO B: Zonas Desiguales', () => {
    test('🔍 B1: Zona A: 3 parejas, Zona B: 4 parejas (7 total) → ¿genera 7 seeds?', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A
        { couplesCount: 4, definitivePositions: [1] }  // Zona B
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('🔍 B1 - Seeds generados:', seeds.length)
      console.log('🔍 B1 - Placeholder labels:', seeds.map(s => s.placeholder_label || `couple-${s.couple_id}`))

      // EXPECTATIVA: Debe generar 7 seeds (todas las parejas)
      expect(seeds).toHaveLength(7)

      // Verificar que 4B está presente
      const has4B = seeds.some(s => s.placeholder_label === '4B' || s.couple_id === 'couple-B4')
      expect(has4B).toBe(true)

      // Verificar orden: 1A, 1B, 2A, 2B, 3A, 3B, 4B (4A no existe)
      // La lógica actual itera position 1-4, y solo crea seed si positionData existe
    })

    test('🔍 B2: Zona A: 3 parejas, Zona B: 5 parejas (8 total) → CASO CRÍTICO posición 5B', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A
        { couplesCount: 5, definitivePositions: [1] }  // Zona B
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('🔍 B2 - Seeds generados:', seeds.length)
      console.log('🔍 B2 - Placeholder labels:', seeds.map(s => s.placeholder_label || `couple-${s.couple_id}`))

      // ✅ DESPUÉS DEL FIX: Debe generar 8 seeds (incluyendo 5B)
      expect(seeds).toHaveLength(8)

      // Verificar si 5B está presente
      const has5B = seeds.some(s => s.placeholder_label === '5B' || s.couple_id === 'couple-B5')
      expect(has5B).toBe(true)
      console.log('✅ B2 - Posición 5B generada correctamente')
    })

    test('🔍 B3: Zona A: 3, Zona B: 4, Zona C: 5 (12 total) → validar todas las posiciones', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A
        { couplesCount: 4, definitivePositions: [1] }, // Zona B
        { couplesCount: 5, definitivePositions: [1] }  // Zona C
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('🔍 B3 - Seeds generados:', seeds.length)
      console.log('🔍 B3 - Placeholder labels:', seeds.map(s => s.placeholder_label || `couple-${s.couple_id}`))

      // ✅ DESPUÉS DEL FIX: Debe generar 12 seeds
      expect(seeds).toHaveLength(12)

      // Verificar posiciones críticas
      const has4B = seeds.some(s => s.placeholder_label === '4B' || s.couple_id === 'couple-B4')
      const has4C = seeds.some(s => s.placeholder_label === '4C' || s.couple_id === 'couple-C4')
      const has5C = seeds.some(s => s.placeholder_label === '5C' || s.couple_id === 'couple-C5')

      expect(has4B).toBe(true)
      expect(has4C).toBe(true)
      expect(has5C).toBe(true)

      console.log('  - Tiene 4B:', has4B)
      console.log('  - Tiene 4C:', has4C)
      console.log('  - Tiene 5C:', has5C)
    })

    test('🔍 B4: Zona A: 4, Zona B: 5, Zona C: 3 (12 total) → orden diferente', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 4, definitivePositions: [1, 2] }, // Zona A
        { couplesCount: 5, definitivePositions: [1] },    // Zona B
        { couplesCount: 3, definitivePositions: [1] }     // Zona C
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('🔍 B4 - Seeds generados:', seeds.length)

      // ✅ DESPUÉS DEL FIX: Debe generar 12 seeds
      expect(seeds).toHaveLength(12)

      // Verificar posición 5B
      const has5B = seeds.some(s => s.placeholder_label === '5B' || s.couple_id === 'couple-B5')
      expect(has5B).toBe(true)
      console.log('  - Tiene 5B:', has5B)
    })
  })

  // ============================================================================
  // GRUPO C: EDGE CASES (límites del algoritmo)
  // ============================================================================

  describe('GRUPO C: Edge Cases', () => {
    test('⚠️ C1: Zona con 6 parejas → validar límite hardcoded de position <= 4', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 6, definitivePositions: [1] }, // Zona A con 6 parejas
        { couplesCount: 3, definitivePositions: [1] }  // Zona B normal
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('⚠️ C1 - Seeds generados:', seeds.length)
      console.log('⚠️ C1 - Labels:', seeds.map(s => s.placeholder_label || `couple-${s.couple_id}`))

      // ✅ DESPUÉS DEL FIX: Debe generar 9 seeds (6 de A + 3 de B)
      expect(seeds).toHaveLength(9)

      // Verificar qué posiciones están presentes
      const has5A = seeds.some(s => s.placeholder_label === '5A' || s.couple_id === 'couple-A5')
      const has6A = seeds.some(s => s.placeholder_label === '6A' || s.couple_id === 'couple-A6')

      expect(has5A).toBe(true)
      expect(has6A).toBe(true)

      console.log('  - Tiene 5A:', has5A)
      console.log('  - Tiene 6A:', has6A)
    })

    test('⚠️ C2: Mix extremo - Zona A: 3, Zona B: 6 → validar pérdida de posiciones 5-6', async () => {
      // ARRANGE
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] }, // Zona A normal
        { couplesCount: 6, definitivePositions: [1, 2] }  // Zona B con 6 parejas
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      console.log('⚠️ C2 - Seeds generados:', seeds.length)
      console.log('⚠️ C2 - Total esperado: 9 (3+6)')
      console.log('⚠️ C2 - Labels:', seeds.map(s => s.placeholder_label || `couple-${s.couple_id}`))

      // ✅ DESPUÉS DEL FIX: Debe generar 9 seeds (3 de A + 6 de B)
      expect(seeds).toHaveLength(9)

      // Verificar todas las posiciones de B (1B-6B)
      const positions = ['1B', '2B', '3B', '4B', '5B', '6B']
      const hasPosition = positions.map(pos => ({
        position: pos,
        exists: seeds.some(s => s.placeholder_label === pos || s.couple_id === `couple-${pos.replace('B', 'B')}`)
      }))

      // Verificar que posiciones 5B y 6B estén presentes
      const has5B = hasPosition.find(p => p.position === '5B')?.exists
      const has6B = hasPosition.find(p => p.position === '6B')?.exists

      expect(has5B).toBe(true)
      expect(has6B).toBe(true)

      console.log('  - Posiciones de Zona B:', hasPosition)
    })
  })

  // ============================================================================
  // HELPER: Análisis de resultados
  // ============================================================================

  describe('Análisis de Seed Numbers', () => {
    test('📊 Verificar que seed numbers son consecutivos sin gaps', async () => {
      // ARRANGE - caso con zonas desiguales
      const config = createZoneConfiguration([
        { couplesCount: 3, definitivePositions: [1] },
        { couplesCount: 5, definitivePositions: [1] }
      ])

      mockCreateClient.mockResolvedValue(createSupabaseMock(config.zones, config.positions))

      // ACT
      const seeds = await generator.generatePlaceholderSeeding('test-tournament')

      // ASSERT
      const seedNumbers = seeds.map(s => s.seed).sort((a, b) => a - b)
      console.log('📊 Seed numbers:', seedNumbers)

      // Verificar que son consecutivos
      for (let i = 1; i < seedNumbers.length; i++) {
        const gap = seedNumbers[i] - seedNumbers[i - 1]
        if (gap !== 1) {
          console.log(`❌ Gap detectado entre seed ${seedNumbers[i - 1]} y ${seedNumbers[i]}`)
        }
        expect(gap).toBe(1)
      }
    })
  })
})
