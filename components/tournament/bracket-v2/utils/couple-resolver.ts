/**
 * COUPLE RESOLVER UTILITIES
 *
 * Funciones utilitarias para resolver IDs de parejas en matches del bracket.
 * Maneja tanto couple_id directo como tournament_couple_seed_id que requieren resolución.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-XX
 */

import type { BracketMatchV2, SeedInfo } from '../types/bracket-types'

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Resultado de resolución de parejas de un match
 */
export interface ResolvedCoupleIds {
  /** ID de la pareja en slot1 (null si no está asignada) */
  couple1Id: string | null
  /** ID de la pareja en slot2 (null si no está asignada) */
  couple2Id: string | null
  /** Si slot1 fue resuelto via seed */
  slot1FromSeed: boolean
  /** Si slot2 fue resuelto via seed */
  slot2FromSeed: boolean
  /** Si ambas parejas están definidas */
  bothDefined: boolean
}

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Resuelve los IDs reales de parejas de un match
 *
 * Maneja tres casos:
 * 1. couple_id directo en match.participants.slotX.couple
 * 2. tournament_couple_seed_id que debe buscarse en seeds
 * 3. Slot vacío (no hay pareja asignada)
 *
 * @param match - Match del bracket
 * @param seeds - Array de seeds del torneo (de bracketData.seeds)
 * @returns Objeto con couple IDs resueltos
 *
 * @example
 * ```tsx
 * const { couple1Id, couple2Id, bothDefined } = resolveCoupleIds(match, bracketData.seeds)
 *
 * if (bothDefined) {
 *   // Ambas parejas están definidas, podemos verificar conflictos
 * }
 * ```
 */
export function resolveCoupleIds(
  match: BracketMatchV2,
  seeds: SeedInfo[]
): ResolvedCoupleIds {
  // Construir map de seedId -> coupleId para búsqueda O(1)
  const seedMap = new Map<string, string>()
  seeds.forEach(seed => {
    if (seed.couple_id) {
      // Asumimos que SeedInfo tiene un ID o usamos el couple_id como key
      // En la práctica, el seed puede venir con su ID en el objeto
      seedMap.set(seed.couple_id, seed.couple_id)
    }
  })

  // RESOLVER SLOT 1
  let couple1Id: string | null = null
  let slot1FromSeed = false

  // Primero intentar obtener couple directo
  if (match.participants?.slot1?.couple?.id) {
    couple1Id = match.participants.slot1.couple.id
  }
  // Si no hay couple directo, buscar via seed
  else if (match.participants?.slot1?.seed?.couple_id) {
    couple1Id = match.participants.slot1.seed.couple_id
    slot1FromSeed = true
  }

  // RESOLVER SLOT 2
  let couple2Id: string | null = null
  let slot2FromSeed = false

  // Primero intentar obtener couple directo
  if (match.participants?.slot2?.couple?.id) {
    couple2Id = match.participants.slot2.couple.id
  }
  // Si no hay couple directo, buscar via seed
  else if (match.participants?.slot2?.seed?.couple_id) {
    couple2Id = match.participants.slot2.seed.couple_id
    slot2FromSeed = true
  }

  return {
    couple1Id,
    couple2Id,
    slot1FromSeed,
    slot2FromSeed,
    bothDefined: !!couple1Id && !!couple2Id
  }
}

/**
 * Resuelve el couple_id de un slot específico
 *
 * @param match - Match del bracket
 * @param slotPosition - Posición del slot ('slot1' o 'slot2')
 * @param seeds - Array de seeds del torneo
 * @returns couple_id resuelto o null
 */
export function resolveSlotCoupleId(
  match: BracketMatchV2,
  slotPosition: 'slot1' | 'slot2',
  seeds: SeedInfo[]
): string | null {
  const slot = match.participants?.[slotPosition]
  if (!slot) return null

  // Intentar couple directo primero
  if (slot.couple?.id) {
    return slot.couple.id
  }

  // Intentar via seed
  if (slot.seed?.couple_id) {
    return slot.seed.couple_id
  }

  return null
}

/**
 * Verifica si un match tiene ambas parejas asignadas (listas para jugar)
 *
 * @param match - Match del bracket
 * @param seeds - Array de seeds del torneo
 * @returns true si ambas parejas están asignadas
 */
export function hasMatchBothCouples(
  match: BracketMatchV2,
  seeds: SeedInfo[]
): boolean {
  const { bothDefined } = resolveCoupleIds(match, seeds)
  return bothDefined
}

/**
 * Obtiene información descriptiva de la resolución de parejas
 *
 * Útil para debugging o mostrar al usuario cómo se resolvió un match
 *
 * @param match - Match del bracket
 * @param seeds - Array de seeds del torneo
 * @returns String descriptivo
 */
export function getResolutionInfo(
  match: BracketMatchV2,
  seeds: SeedInfo[]
): string {
  const { couple1Id, couple2Id, slot1FromSeed, slot2FromSeed, bothDefined } = resolveCoupleIds(match, seeds)

  if (!couple1Id && !couple2Id) {
    return 'Ambos slots vacíos'
  }

  if (!couple1Id) {
    return `Slot1 vacío, Slot2: ${slot2FromSeed ? 'resuelto via seed' : 'couple directo'}`
  }

  if (!couple2Id) {
    return `Slot1: ${slot1FromSeed ? 'resuelto via seed' : 'couple directo'}, Slot2 vacío`
  }

  if (bothDefined) {
    const s1 = slot1FromSeed ? 'seed' : 'directo'
    const s2 = slot2FromSeed ? 'seed' : 'directo'
    return `Ambos slots: Slot1 (${s1}), Slot2 (${s2})`
  }

  return 'Estado desconocido'
}

// ============================================================================
// HELPERS ADICIONALES
// ============================================================================

/**
 * Verifica si un match puede jugarse (tiene ambas parejas y está PENDING)
 *
 * @param match - Match del bracket
 * @param seeds - Array de seeds del torneo
 * @returns true si puede jugarse
 */
export function canMatchBePlayed(
  match: BracketMatchV2,
  seeds: SeedInfo[]
): boolean {
  return match.status === 'PENDING' && hasMatchBothCouples(match, seeds)
}

/**
 * Verifica si un match está esperando resolución de placeholders
 *
 * @param match - Match del bracket
 * @returns true si tiene placeholders pendientes
 */
export function hasUnresolvedPlaceholders(match: BracketMatchV2): boolean {
  const slot1HasPlaceholder = match.participants?.slot1?.type === 'placeholder' &&
    !match.participants?.slot1?.couple

  const slot2HasPlaceholder = match.participants?.slot2?.type === 'placeholder' &&
    !match.participants?.slot2?.couple

  return slot1HasPlaceholder || slot2HasPlaceholder
}
