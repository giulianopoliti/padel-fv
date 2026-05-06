import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClientServiceRole } from '@/utils/supabase/server'
import { CorrectedDefinitiveAnalyzer } from '@/lib/services/corrected-definitive-analyzer'

/**
 * API endpoint para actualizar posiciones definitivas en zone_positions
 * 
 * POST /api/tournaments/[id]/update-definitive-positions
 * Analiza todas las zonas del torneo y actualiza is_definitive correctamente
 * 
 * ALGORITMO CORREGIDO:
 * - NIVEL 1: Fast Validation (solo casos 100% seguros) 
 * - NIVEL 2: Constraint Analysis Global (considera TODAS las parejas)
 * - NIVEL 3: Backtracking Selectivo (casos complejos con límites)
 */

interface PositionAnalysisResult {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: string
  analysisDetails: string
  confidence: number
  performanceMetrics: {
    executionTimeMs: number
    scenariosProcessed: number
    totalScenarios: number
    cacheHits: number
  }
}

// Todos los resultados posibles en un partido de padel
const ALL_POSSIBLE_MATCH_RESULTS = [
  { couple1Games: 6, couple2Games: 0, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 1, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 2, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 3, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 4, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 6, winner: 'couple1' },
  { couple1Games: 0, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 1, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 2, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 3, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 4, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 7, winner: 'couple2' },
  { couple1Games: 6, couple2Games: 7, winner: 'couple2' }
] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    console.log(`[UPDATE-DEFINITIVE] 🔍 Analyzing definitive positions for tournament: ${tournamentId}`)

    // Use service role to bypass RLS for internal system operations
    const supabase = await createClientServiceRole()

    // 1. Obtener todas las zonas del torneo
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId)

    if (zonesError) {
      throw new Error(`Error fetching zones: ${zonesError.message}`)
    }

    if (!zones || zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No zones found for tournament' },
        { status: 404 }
      )
    }

    console.log(`[UPDATE-DEFINITIVE] 📊 Found ${zones.length} zones to analyze`)

    let totalUpdates = 0
    const zoneResults: any[] = []

    // 2. Inicializar analizador corregido
    const analyzer = new CorrectedDefinitiveAnalyzer()
    
    // 3. Analizar cada zona
    for (const zone of zones) {
      console.log(`[UPDATE-DEFINITIVE] 🔍 Analyzing zone: ${zone.name} (${zone.id})`)
      
      try {
        const analysis = await analyzer.analyzeZonePositions(zone.id)
      
      // 4. Actualizar is_definitive en base de datos
      let zoneUpdates = 0
      for (const result of analysis.analysis) {
        console.log(`[UPDATE-DEFINITIVE] 🔍 Updating couple ${result.coupleId} in zone ${zone.name}`)
        console.log(`[UPDATE-DEFINITIVE] 🔍 Setting is_definitive=${result.isDefinitive} for couple ${result.coupleId}`)
        const { error: updateError } = await supabase
          .from('zone_positions')
          .update({ 
            is_definitive: result.isDefinitive,
            updated_at: new Date().toISOString()
          })
          .eq('zone_id', zone.id)
          .eq('couple_id', result.coupleId)

        if (updateError) {
          console.error(`[UPDATE-DEFINITIVE] ❌ Error updating couple ${result.coupleId}:`, updateError)
        } else {
          zoneUpdates++
          totalUpdates++
        }
      }

      const definitiveCount = analysis.definitivePositions
      
      zoneResults.push({
        zoneId: zone.id,
        zoneName: zone.name,
        totalCouples: analysis.totalCouples,
        definitivePositions: definitiveCount,
        nonDefinitivePositions: analysis.totalCouples - definitiveCount,
        updatesApplied: zoneUpdates,
        totalComputationTime: analysis.totalComputationTime,
        optimizationsApplied: analysis.optimizationsApplied,
        analysis: analysis.analysis.map(r => ({
          coupleId: r.coupleId,
          position: r.currentPosition,
          isDefinitive: r.isDefinitive,
          possiblePositions: r.possiblePositions,
          method: r.analysisMethod,
          details: r.analysisDetails,
          confidence: r.confidence,
          computationTime: r.computationTime
        }))
      })

      console.log(`[UPDATE-DEFINITIVE] ✅ Zone ${zone.name}: ${definitiveCount}/${analysis.analysis.length} definitive, ${zoneUpdates} updates applied`)
      
      } catch (error: any) {
        console.warn(`[UPDATE-DEFINITIVE] ⚠️ Zone ${zone.name} skipped: ${error.message}`)
        zoneResults.push({
          zoneId: zone.id,
          zoneName: zone.name,
          totalCouples: 0,
          definitivePositions: 0,
          nonDefinitivePositions: 0,
          updatesApplied: 0,
          totalComputationTime: 0,
          optimizationsApplied: ['ZONE_SKIPPED'],
          analysis: [],
          error: error.message
        })
      }
    }
    
    // 5. Limpiar caché del analizador
    analyzer.clearCache()
    const performanceMetrics = analyzer.getPerformanceMetrics()

    console.log(`[UPDATE-DEFINITIVE] 🎉 Analysis complete: ${totalUpdates} total updates applied`)

    return NextResponse.json({
      success: true,
      message: `Corrected definitive positions analysis completed for ${zones.length} zones`,
      tournamentId,
      totalUpdates,
      zonesAnalyzed: zones.length,
      algorithmVersion: 'CORRECTED_3_LEVELS',
      performanceMetrics,
      results: zoneResults
    })

  } catch (error: any) {
    console.error('[UPDATE-DEFINITIVE] ❌ Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error analyzing definitive positions' 
      },
      { status: 500 }
    )
  }
}

/**
 * FUNCIONES OBSOLETAS ELIMINADAS
 * 
 * Las siguientes funciones han sido reemplazadas por CorrectedDefinitiveAnalyzer:
 * - analyzeZonePositions() → analyzer.analyzeZonePositions()
 * - checkFastValidationCases() → analyzer.checkCorrectedFastValidation()
 * - analyzePositionByBacktracking() → analyzer.performSelectiveBacktracking()
 * 
 * El nuevo algoritmo corrige errores lógicos y mejora el rendimiento:
 * - ❌ Eliminado: "Si pareja no participa en pendientes → definitiva"
 * - ✅ Constraint analysis que considera TODAS las parejas
 * - ✅ Backtracking selectivo con límites de tiempo
 * - ✅ Sistema de caché para optimización
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  return NextResponse.json(
    { 
      message: 'Corrected definitive positions endpoint',
      tournament_id: tournamentId,
      available_methods: ['POST'],
      algorithm_version: 'CORRECTED_3_LEVELS',
      description: 'Use POST to analyze and update definitive positions using corrected 3-level algorithm',
      levels: {
        level1: 'Fast Validation (only 100% certain cases)',
        level2: 'Global Constraint Analysis (considers ALL couples)',
        level3: 'Selective Backtracking (complex cases with time limits)'
      },
      corrections: [
        'Removed incorrect "no pending matches for couple → definitive" logic',
        'Added global constraint analysis for all couples',
        'Implemented time-limited backtracking with conservative fallback'
      ]
    }
  )
}