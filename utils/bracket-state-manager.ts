/**
 * FLEXIBLE BRACKET STATE MANAGEMENT SYSTEM
 * 
 * Manages the different states of a tournament bracket and provides
 * intelligent rules for when regeneration is allowed or restricted.
 */

import { createClient } from "@/utils/supabase/server"
import type { Database } from '@/database.types'

export enum BracketState {
  NOT_GENERATED = 'NOT_GENERATED',           // Zones active, no bracket yet
  GENERATED_PREVIEW = 'GENERATED_PREVIEW',   // Bracket exists but no matches played
  ACTIVE_LOCKED = 'ACTIVE_LOCKED',           // Elimination matches started
  COMPLETED = 'COMPLETED'                    // Tournament finished
}

export interface BracketStateInfo {
  state: BracketState
  canAddCouples: boolean
  canRegenerate: boolean
  requiresConfirmation: boolean
  warningMessage?: string
  eliminationMatchesCount: number
  playedMatchesCount: number
  lastGeneratedAt?: string
  totalCouplesWhenGenerated?: number
  currentTotalCouples?: number
}

export interface RegenerationRules {
  allowAddCouples: boolean
  autoRegenerate: boolean
  showWarning: boolean
  requireConfirmation?: boolean
  showAlternatives?: string[]
}

export const REGENERATION_RULES: Record<BracketState, RegenerationRules> = {
  [BracketState.NOT_GENERATED]: { 
    allowAddCouples: true,
    autoRegenerate: true,
    showWarning: false 
  },
  [BracketState.GENERATED_PREVIEW]: { 
    allowAddCouples: true,
    autoRegenerate: false,
    showWarning: true,
    requireConfirmation: true
  },
  [BracketState.ACTIVE_LOCKED]: { 
    allowAddCouples: false,
    autoRegenerate: false,
    showWarning: true,
    requireConfirmation: true,
    showAlternatives: ["Agregar al próximo torneo", "Crear playoff separado"]
  },
  [BracketState.COMPLETED]: { 
    allowAddCouples: false,
    autoRegenerate: false,
    showWarning: true,
    showAlternatives: ["El torneo ya finalizó"]
  }
}

/**
 * Analyzes the current state of a tournament bracket
 */
export async function analyzeBracketState(tournamentId: string): Promise<BracketStateInfo> {
  const supabase = await createClient()
  
  // Get tournament basic info
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status, bracket_status, registration_locked, bracket_generated_at')
    .eq('id', tournamentId)
    .single()

  // Get elimination matches info
  const { data: eliminationMatches } = await supabase
    .from('matches')
    .select('id, status, type, created_at')
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')

  // Get total couples count
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('tournament_id', tournamentId)

  const eliminationMatchesCount = eliminationMatches?.length || 0
  const playedMatchesCount = eliminationMatches?.filter(m => 
    m.status === 'FINISHED' || m.status === 'IN_PROGRESS'
  ).length || 0
  const currentTotalCouples = inscriptions?.length || 0

  // Determine bracket state
  let state: BracketState

  if (tournament?.status === 'FINISHED') {
    state = BracketState.COMPLETED
  } else if (eliminationMatchesCount === 0) {
    state = BracketState.NOT_GENERATED
  } else if (playedMatchesCount === 0) {
    state = BracketState.GENERATED_PREVIEW
  } else {
    state = BracketState.ACTIVE_LOCKED
  }

  const rules = REGENERATION_RULES[state]
  
  // Generate warning messages based on state
  let warningMessage: string | undefined
  switch (state) {
    case BracketState.GENERATED_PREVIEW:
      warningMessage = "⚠️ Agregar parejas regenerará completamente el bracket"
      break
    case BracketState.ACTIVE_LOCKED:
      warningMessage = "🚫 Hay matches jugados. Agregar parejas eliminará todos los resultados"
      break
    case BracketState.COMPLETED:
      warningMessage = "✅ Torneo completado. No se pueden hacer cambios"
      break
  }

  return {
    state,
    canAddCouples: rules.allowAddCouples,
    canRegenerate: rules.autoRegenerate || (rules.requireConfirmation && state !== BracketState.COMPLETED),
    requiresConfirmation: rules.requireConfirmation || false,
    warningMessage,
    eliminationMatchesCount,
    playedMatchesCount,
    currentTotalCouples,
    lastGeneratedAt: tournament?.bracket_generated_at || eliminationMatches?.[0]?.created_at
  }
}

/**
 * Checks if bracket needs regeneration due to changes in zones
 */
export async function checkBracketNeedsRegeneration(tournamentId: string): Promise<{
  needsRegeneration: boolean
  reason?: string
  currentCouples: number
  bracketGeneratedFor?: number
}> {
  const supabase = await createClient()
  
  // Get current couples count
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('tournament_id', tournamentId)

  const currentCouples = inscriptions?.length || 0

  // Get when bracket was last generated and for how many couples
  const { data: lastGeneration } = await supabase
    .from('matches')
    .select('created_at')
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastGeneration) {
    return {
      needsRegeneration: false,
      currentCouples
    }
  }

  // Count total matches that should exist for current couples
  const expectedBracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, currentCouples))))
  
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('type', 'ELIMINATION')

  const existingMatchesCount = existingMatches?.length || 0
  const expectedMatchesCount = expectedBracketSize - 1 // Total matches in elimination bracket

  const needsRegeneration = existingMatchesCount !== expectedMatchesCount

  return {
    needsRegeneration,
    reason: needsRegeneration ? 
      `Expected ${expectedMatchesCount} matches for ${currentCouples} couples, but found ${existingMatchesCount}` : 
      undefined,
    currentCouples,
    bracketGeneratedFor: existingMatchesCount > 0 ? 
      Math.pow(2, Math.ceil(Math.log2(existingMatchesCount + 1))) : undefined
  }
}

/**
 * Validates if a specific action is allowed in the current bracket state
 */
export async function validateBracketAction(
  tournamentId: string, 
  action: 'ADD_COUPLE' | 'REGENERATE_BRACKET' | 'MODIFY_MATCH'
): Promise<{
  allowed: boolean
  warning?: string
  requiresConfirmation?: boolean
  alternatives?: string[]
}> {
  const stateInfo = await analyzeBracketState(tournamentId)
  const rules = REGENERATION_RULES[stateInfo.state]

  switch (action) {
    case 'ADD_COUPLE':
      return {
        allowed: stateInfo.canAddCouples,
        warning: stateInfo.warningMessage,
        requiresConfirmation: rules.requireConfirmation,
        alternatives: rules.showAlternatives
      }

    case 'REGENERATE_BRACKET':
      return {
        allowed: stateInfo.canRegenerate,
        warning: stateInfo.playedMatchesCount > 0 ? 
          `⚠️ Regenerar eliminará ${stateInfo.playedMatchesCount} resultados de matches jugados` : 
          stateInfo.warningMessage,
        requiresConfirmation: rules.requireConfirmation || stateInfo.playedMatchesCount > 0
      }

    case 'MODIFY_MATCH':
      return {
        allowed: stateInfo.state !== BracketState.COMPLETED,
        warning: stateInfo.state === BracketState.COMPLETED ? 
          "No se pueden modificar matches en un torneo completado" : undefined
      }

    default:
      return { allowed: false, warning: "Acción no reconocida" }
  }
}

/**
 * Gets human-readable description of bracket state
 */
export function getBracketStateDescription(state: BracketState): string {
  switch (state) {
    case BracketState.NOT_GENERATED:
      return "Fase de Zonas - Bracket no generado"
    case BracketState.GENERATED_PREVIEW:
      return "Bracket Generado - Sin matches jugados"
    case BracketState.ACTIVE_LOCKED:
      return "Eliminación Activa - Matches en progreso"
    case BracketState.COMPLETED:
      return "Torneo Completado"
    default:
      return "Estado desconocido"
  }
}