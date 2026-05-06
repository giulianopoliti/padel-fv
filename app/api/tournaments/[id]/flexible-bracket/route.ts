/**
 * FLEXIBLE BRACKET API ROUTE
 * 
 * Provides endpoints for bracket generation, regeneration, and impact analysis
 * with intelligent state management and safety checks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  generateFlexibleBracket, 
  previewBracketRegeneration as oldPreviewBracketRegeneration, 
  smartBracketRegeneration 
} from '@/utils/flexible-bracket-generator'
import {
  generatePlaceholderBracket,
  generateRealDataBracket,
  toggleBracketData
} from '@/utils/simple-bracket-system'
import { 
  analyzeBracketState, 
  validateBracketAction, 
  checkBracketNeedsRegeneration 
} from '@/utils/bracket-state-manager'
import { generateSerpentineBracketAction } from '../actions'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'state':
        // Get current bracket state information
        const stateInfo = await analyzeBracketState(tournamentId)
        return NextResponse.json({
          success: true,
          state: stateInfo
        })

      case 'check-regeneration':
        // Check if bracket needs regeneration
        const regenerationCheck = await checkBracketNeedsRegeneration(tournamentId)
        return NextResponse.json({
          success: true,
          regenerationCheck
        })

      case 'preview':
        // Preview bracket generation (simplified)
        return NextResponse.json({
          success: true,
          preview: {
            message: "Sistema simplificado - siempre permite regeneración",
            canGenerate: true,
            noRestrictions: true
          }
        })

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action. Use: state, check-regeneration, or preview"
        }, { status: 400 })
    }

  } catch (error) {
    console.error('[Bracket API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id
    const body = await request.json().catch(() => ({}))
    const { 
      action = 'generate', 
      force = false, 
      preservePlayedMatches = false,
      algorithm = 'traditional' // 'traditional' o 'serpentine'
    } = body

    console.log(`[Bracket API] POST ${action} for tournament ${tournamentId}`)

    switch (action) {
      case 'generate':
      case 'regenerate':
        // Validate if regeneration is allowed
        const validation = await validateBracketAction(tournamentId, 'REGENERATE_BRACKET')
        
        if (!validation.allowed && !force) {
          return NextResponse.json({
            success: false,
            error: validation.warning || "Regeneration not allowed",
            requiresConfirmation: validation.requiresConfirmation,
            alternatives: validation.alternatives
          }, { status: 403 })
        }

        // Seleccionar algoritmo de generación
        let result
        
        if (action === 'generate' || action === 'regenerate') {
          console.log(`[Bracket API] Using ${algorithm} algorithm`)
          
          if (algorithm === 'serpentine') {
            // 🐍 Usar algoritmo serpentino
            const serpentineResult = await generateSerpentineBracketAction(tournamentId)
            
            // Convertir a formato compatible con flexible-bracket
            result = {
              success: serpentineResult.success,
              error: serpentineResult.error,
              matches: serpentineResult.matches_created || 0,
              message: serpentineResult.message,
              impactAnalysis: {
                totalMatches: serpentineResult.matches_created || 0,
                newMatches: serpentineResult.matches_created || 0,
                preservedMatches: 0,
                deletedMatches: 0,
                warnings: [],
                algorithm: 'serpentine',
                guarantee: '1A and 1B can only meet in finals'
              },
              stats: {
                totalMatches: serpentineResult.matches_created || 0,
                withRealData: serpentineResult.matches_created || 0,
                withPlaceholders: 0,
                algorithm: 'serpentine'
              },
              bracket: serpentineResult.bracket
            }
          } else {
            // Usar sistema tradicional
            const shouldUseRealData = body.useRealData === true
            const simpleResult = shouldUseRealData ? 
              await generateRealDataBracket(tournamentId) :
              await generatePlaceholderBracket(tournamentId)
            
            // Convertir a formato compatible
            result = {
              success: simpleResult.success,
              error: simpleResult.error,
              matches: simpleResult.matches,
              message: simpleResult.message,
              impactAnalysis: {
                totalMatches: simpleResult.stats.totalMatches,
                newMatches: simpleResult.stats.withRealData,
                preservedMatches: 0,
                deletedMatches: 0,
                warnings: [],
                algorithm: 'traditional'
              },
              stats: simpleResult.stats
            }
          }
        } else {
          result = { success: false, error: "Acción no reconocida" }
        }

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error,
            impactAnalysis: result.impactAnalysis
          }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: result.message || (action === 'generate' ? 'Bracket generado' : 'Bracket regenerado'),
          matches: result.matches,
          stats: result.stats,
          impactAnalysis: result.impactAnalysis,
          bracket: result.bracket, // Include serpentine bracket data if available
          // Info del sistema con algoritmo utilizado
          systemInfo: {
            type: algorithm === 'serpentine' ? 'serpentine' : 'simple',
            algorithm: algorithm,
            noRestrictions: true,
            alwaysRegenerable: true,
            canToggleData: algorithm !== 'serpentine', // Can't toggle data with serpentine
            guarantee: algorithm === 'serpentine' ? '1A and 1B can only meet in finals' : undefined
          }
        })

      case 'validate-add-couple':
        // Sistema simple: siempre permitido
        return NextResponse.json({
          success: true,
          validation: {
            allowed: true,
            warning: "Sistema simple: siempre se puede agregar parejas",
            requiresConfirmation: false
          }
        })

      case 'toggle-data':
        // Alternar entre placeholders y datos reales
        const toggleToRealData = body.useRealData === true
        const toggleResult = await toggleBracketData(tournamentId, toggleToRealData)
        
        return NextResponse.json({
          success: toggleResult.success,
          message: toggleResult.message,
          matches: toggleResult.matches,
          stats: toggleResult.stats,
          useRealData: toggleToRealData
        })

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action. Use: generate, regenerate, or validate-add-couple"
        }, { status: 400 })
    }

  } catch (error) {
    console.error('[Bracket API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id
    
    // Validate if deletion is allowed
    const validation = await validateBracketAction(tournamentId, 'REGENERATE_BRACKET')
    
    if (!validation.allowed) {
      return NextResponse.json({
        success: false,
        error: "Cannot delete bracket in current state",
        warning: validation.warning
      }, { status: 403 })
    }

    // Delete all elimination matches
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Error deleting bracket: ${error.message}`
      }, { status: 500 })
    }

    // Update tournament status
    await supabase
      .from('tournaments')
      .update({ 
        bracket_status: 'NOT_STARTED',
        registration_locked: false
      })
      .eq('id', tournamentId)

    return NextResponse.json({
      success: true,
      message: "Bracket eliminado exitosamente. El registro está nuevamente abierto."
    })

  } catch (error) {
    console.error('[Bracket API] DELETE Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}