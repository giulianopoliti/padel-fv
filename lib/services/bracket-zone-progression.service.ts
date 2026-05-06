import { createClientServiceRole } from '@/utils/supabase/server'
import { getPersistedBracketArtifacts } from '@/lib/services/bracket-generation-validation'

export interface BracketZoneProgressionResult {
  success: boolean
  positionsUpdated: boolean
  bracketAdvanced: boolean
  placeholdersResolved: number
  message: string
}

interface BracketZoneProgressionDependencies {
  tournamentId: string
  zoneId: string
  canAdvanceBracket: () => Promise<{
    canAdvance: boolean
    definitiveCouples: Array<unknown>
    reason?: string
  }>
  generateProgressiveBracket: () => Promise<{
    success: boolean
    message: string
  }>
}

type PlaceholderResolutionResult = {
  success: boolean
  placeholdersResolved: number
  resolutionDetails: unknown[]
  performance: {
    algorithmUsed: string
    executionTime: number
    operationsPerformed?: number
  }
}

function createSkippedPlaceholderResult(reason: string): PlaceholderResolutionResult {
  console.log(reason)
  return {
    success: true,
    placeholdersResolved: 0,
    resolutionDetails: [],
    performance: { algorithmUsed: 'SKIPPED', executionTime: 0 }
  }
}

async function resolvePlaceholdersIfNeeded(
  tournamentId: string,
  zoneId: string
): Promise<PlaceholderResolutionResult> {
  const supabase = await createClientServiceRole()
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()

  if (tournamentError) {
    console.error('[BRACKET-ZONE][status] Could not fetch tournament status:', tournamentError)
    return createSkippedPlaceholderResult(
      `[BRACKET-ZONE][status] Defaulting to ZONE_PHASE behavior for tournament ${tournamentId}`
    )
  }

  const tournamentStatus = tournament?.status || 'ZONE_PHASE'
  if (tournamentStatus !== 'BRACKET_PHASE') {
    return createSkippedPlaceholderResult(
      `[BRACKET-ZONE][status] Tournament ${tournamentId} in ${tournamentStatus} - skipping placeholder resolution`
    )
  }

  const bracketArtifacts = await getPersistedBracketArtifacts(tournamentId)
  if (!bracketArtifacts.exists) {
    return createSkippedPlaceholderResult(
      `[BRACKET-ZONE][guard] Tournament ${tournamentId} is in BRACKET_PHASE but has no persisted bracket artifacts`
    )
  }

  console.log(`[BRACKET-ZONE][resolver] Resolving placeholders for tournament ${tournamentId}, zone ${zoneId}`)

  const { getBracketPlaceholderResolver } = await import('@/lib/services/bracket-placeholder-resolver')
  const bracketResolver = getBracketPlaceholderResolver()
  const bracketResult = await bracketResolver.resolveZonePlaceholders(tournamentId, zoneId)

  const placeholderResult: PlaceholderResolutionResult = {
    success: bracketResult.success,
    placeholdersResolved: bracketResult.resolvedSeeds,
    resolutionDetails: [],
    performance: {
      algorithmUsed: 'UNIFIED_TYPESCRIPT',
      executionTime: bracketResult.executionTime,
      operationsPerformed: bracketResult.resolvedSeeds
    }
  }

  console.log('[BRACKET-ZONE][resolver] Unified placeholder resolution result:', {
    success: placeholderResult.success,
    resolved: placeholderResult.placeholdersResolved,
    algorithm: placeholderResult.performance.algorithmUsed,
    executionTime: `${placeholderResult.performance.executionTime}ms`
  })

  return placeholderResult
}

export async function progressBracketAfterZoneUpdate({
  tournamentId,
  zoneId,
  canAdvanceBracket,
  generateProgressiveBracket
}: BracketZoneProgressionDependencies): Promise<BracketZoneProgressionResult> {
  try {
    const placeholderResult = await resolvePlaceholdersIfNeeded(tournamentId, zoneId)
    const shouldAttemptBracketAdvancement = placeholderResult.placeholdersResolved > 0

    if (!shouldAttemptBracketAdvancement) {
      console.log(`[BRACKET-ZONE][advance] Skipping advancement for tournament ${tournamentId} - no placeholders resolved`)
      return {
        success: true,
        positionsUpdated: true,
        bracketAdvanced: false,
        placeholdersResolved: placeholderResult.placeholdersResolved,
        message: `Posiciones actualizadas. Placeholders resueltos: ${placeholderResult.placeholdersResolved}. Esperando más zonas completadas para avanzar bracket.`
      }
    }

    const advancementCheck = await canAdvanceBracket()
    if (!advancementCheck.canAdvance) {
      console.log(`[BRACKET-ZONE][advance] Bracket advancement not allowed for tournament ${tournamentId}: ${advancementCheck.reason || 'unknown reason'}`)
      return {
        success: true,
        positionsUpdated: true,
        bracketAdvanced: false,
        placeholdersResolved: placeholderResult.placeholdersResolved,
        message: `Posiciones actualizadas. Placeholders resueltos: ${placeholderResult.placeholdersResolved}. ${advancementCheck.reason || 'Aún no se puede avanzar el bracket.'}`
      }
    }

    console.log(`[BRACKET-ZONE][advance] Advancement context: ${advancementCheck.definitiveCouples.length} definitive couples available`)

    try {
      if (advancementCheck.definitiveCouples.length < 4) {
        throw new Error(`Insufficient couples for bracket generation: ${advancementCheck.definitiveCouples.length} definitive couples`)
      }

      console.log(`[BRACKET-ZONE][advance] Unified resolver completed with ${placeholderResult.placeholdersResolved} placeholders resolved`)

      return {
        success: true,
        positionsUpdated: true,
        bracketAdvanced: true,
        placeholdersResolved: placeholderResult.placeholdersResolved,
        message: `Posiciones actualizadas y placeholders resueltos usando arquitectura TypeScript unificada. Seeds resueltos: ${placeholderResult.placeholdersResolved}`
      }
    } catch (bracketError) {
      console.error('[BRACKET-ZONE][advance] Bracket advancement failed after zone update:', bracketError)
      const bracketResult = await generateProgressiveBracket()

      return {
        success: true,
        positionsUpdated: true,
        bracketAdvanced: bracketResult.success,
        placeholdersResolved: placeholderResult.placeholdersResolved,
        message: `${bracketResult.message}. Placeholders resueltos: ${placeholderResult.placeholdersResolved}`
      }
    }
  } catch (error) {
    console.error('[BRACKET-ZONE][error] Error progressing bracket after zone update:', error)
    return {
      success: false,
      positionsUpdated: false,
      bracketAdvanced: false,
      placeholdersResolved: 0,
      message: `Error al actualizar posiciones: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}
