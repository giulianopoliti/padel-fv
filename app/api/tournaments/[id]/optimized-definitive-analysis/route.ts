import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { OptimizedDefinitiveAnalyzer } from '@/lib/services/optimized-definitive-analyzer'
import type { ZoneAnalysisResult } from '@/lib/services/optimized-definitive-analyzer'

/**
 * OPTIMIZED DEFINITIVE POSITIONS API
 * 
 * POST /api/tournaments/[id]/optimized-definitive-analysis
 * 
 * Endpoints:
 * - POST: Ejecuta análisis optimizado y actualiza base de datos
 * - GET: Obtiene resultados del último análisis (cached)
 * 
 * Query Parameters:
 * - zones: string[] - IDs específicos de zonas (opcional, por defecto todas)
 * - update_db: boolean - Si actualizar is_definitive en BD (default: true)
 * - use_cache: boolean - Si usar resultados cacheados (default: true)
 * - max_time_ms: number - Tiempo máximo total (default: 5000ms)
 * 
 * Performance Features:
 * - Análisis paralelo de zonas
 * - Cache inteligente basado en estado
 * - Early termination con timeouts
 * - Métricas detalladas de performance
 */

interface AnalysisRequest {
  zones?: string[]
  update_db?: boolean
  use_cache?: boolean
  max_time_ms?: number
  dry_run?: boolean
}

interface AnalysisResponse {
  success: boolean
  tournament_id: string
  analysis_time_ms: number
  zones_analyzed: number
  total_couples: number
  definitive_positions: number
  non_definitive_positions: number
  zones_results: ZoneAnalysisResult[]
  performance_metrics: {
    fast_validations: number
    constraint_analyses: number
    backtracking_runs: number
    cache_hits: number
    total_optimizations: number
    average_time_per_zone: number
  }
  updates_applied?: number
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = performance.now()
  
  try {
    const { id: tournamentId } = await params
    
    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    // Parse request body
    const requestData: AnalysisRequest = await request.json().catch(() => ({}))
    const {
      zones: specificZones,
      update_db = true,
      use_cache = true,
      max_time_ms = 5000,
      dry_run = false
    } = requestData

    console.log(`🚀 [OPTIMIZED-ANALYSIS] Starting for tournament: ${tournamentId}`)
    console.log(`📋 [OPTIMIZED-ANALYSIS] Config: update_db=${update_db}, cache=${use_cache}, max_time=${max_time_ms}ms`)

    const supabase = await createClient()
    const analyzer = new OptimizedDefinitiveAnalyzer()

    // 1. Get zones to analyze
    let zonesToAnalyze: any[]
    
    if (specificZones && specificZones.length > 0) {
      const { data: zones, error } = await supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', tournamentId)
        .in('id', specificZones)
      
      if (error) throw new Error(`Error fetching specific zones: ${error.message}`)
      zonesToAnalyze = zones || []
    } else {
      const { data: zones, error } = await supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', tournamentId)
      
      if (error) throw new Error(`Error fetching zones: ${error.message}`)
      zonesToAnalyze = zones || []
    }

    if (zonesToAnalyze.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No zones found for analysis' },
        { status: 404 }
      )
    }

    console.log(`📊 [OPTIMIZED-ANALYSIS] Analyzing ${zonesToAnalyze.length} zones`)

    // 2. Performance tracking
    const performanceMetrics = {
      fast_validations: 0,
      constraint_analyses: 0,
      backtracking_runs: 0,
      cache_hits: 0,
      total_optimizations: 0,
      average_time_per_zone: 0
    }

    // 3. Run analysis (parallel for independent zones)
    const analysisPromises = zonesToAnalyze.map(async (zone) => {
      const zoneStartTime = performance.now()
      
      try {
        const result = await analyzer.analyzeZoneOptimized(zone.id)
        
        // Update performance metrics
        for (const analysis of result.positionAnalyses) {
          switch (analysis.analysisMethod) {
            case 'FAST_VALIDATION':
              performanceMetrics.fast_validations++
              break
            case 'CONSTRAINT_ANALYSIS':
              performanceMetrics.constraint_analyses++
              break
            case 'BACKTRACKING_FULL':
            case 'BACKTRACKING_LIMITED':
              performanceMetrics.backtracking_runs++
              break
          }
        }
        
        performanceMetrics.total_optimizations += result.optimizationsSaved.length
        
        console.log(`✅ [OPTIMIZED-ANALYSIS] Zone ${zone.name}: ${result.definitivePositions}/${result.totalCouples} definitive (${result.analysisTimeMs}ms)`)
        
        return result
      } catch (error) {
        console.error(`❌ [OPTIMIZED-ANALYSIS] Error analyzing zone ${zone.name}:`, error)
        throw error
      }
    })

    // Wait for all analyses with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Analysis timeout after ${max_time_ms}ms`)), max_time_ms)
    })

    const zonesResults = await Promise.race([
      Promise.all(analysisPromises),
      timeoutPromise
    ]) as ZoneAnalysisResult[]

    // 4. Calculate totals
    const totalCouples = zonesResults.reduce((sum, zone) => sum + zone.totalCouples, 0)
    const definitivePositions = zonesResults.reduce((sum, zone) => sum + zone.definitivePositions, 0)
    const nonDefinitivePositions = totalCouples - definitivePositions

    // Calculate average time per zone
    performanceMetrics.average_time_per_zone = zonesResults.length > 0 
      ? Math.round(zonesResults.reduce((sum, zone) => sum + zone.analysisTimeMs, 0) / zonesResults.length)
      : 0

    // 5. Update database if requested
    let updatesApplied = 0
    
    if (update_db && !dry_run) {
      console.log(`💾 [OPTIMIZED-ANALYSIS] Updating database for ${zonesResults.length} zones`)
      
      for (const zoneResult of zonesResults) {
        for (const analysis of zoneResult.positionAnalyses) {
          try {
            const { error: updateError } = await supabase
              .from('zone_positions')
              .update({ 
                is_definitive: analysis.isDefinitive,
                updated_at: new Date().toISOString()
              })
              .eq('zone_id', zoneResult.zoneId)
              .eq('couple_id', analysis.coupleId)

            if (updateError) {
              console.error(`❌ [OPTIMIZED-ANALYSIS] Error updating couple ${analysis.coupleId}:`, updateError)
            } else {
              updatesApplied++
            }
          } catch (error) {
            console.error(`❌ [OPTIMIZED-ANALYSIS] Database error for couple ${analysis.coupleId}:`, error)
          }
        }
      }
      
      console.log(`✅ [OPTIMIZED-ANALYSIS] Applied ${updatesApplied} database updates`)
    }

    const totalTime = performance.now() - startTime

    // 6. Build response
    const response: AnalysisResponse = {
      success: true,
      tournament_id: tournamentId,
      analysis_time_ms: Math.round(totalTime),
      zones_analyzed: zonesResults.length,
      total_couples: totalCouples,
      definitive_positions: definitivePositions,
      non_definitive_positions: nonDefinitivePositions,
      zones_results: zonesResults,
      performance_metrics: performanceMetrics,
      ...(update_db && !dry_run && { updates_applied: updatesApplied })
    }

    console.log(`🎉 [OPTIMIZED-ANALYSIS] Complete: ${definitivePositions}/${totalCouples} definitive positions (${Math.round(totalTime)}ms)`)
    console.log(`📈 [OPTIMIZED-ANALYSIS] Performance: ${performanceMetrics.fast_validations} fast, ${performanceMetrics.constraint_analyses} constraint, ${performanceMetrics.backtracking_runs} backtrack`)

    return NextResponse.json(response)

  } catch (error: any) {
    const totalTime = performance.now() - startTime
    
    console.error('[OPTIMIZED-ANALYSIS] ❌ Error:', error)
    
    const errorResponse: AnalysisResponse = {
      success: false,
      tournament_id: '',
      analysis_time_ms: Math.round(totalTime),
      zones_analyzed: 0,
      total_couples: 0,
      definitive_positions: 0,
      non_definitive_positions: 0,
      zones_results: [],
      performance_metrics: {
        fast_validations: 0,
        constraint_analyses: 0,
        backtracking_runs: 0,
        cache_hits: 0,
        total_optimizations: 0,
        average_time_per_zone: 0
      },
      error: error.message || 'Unknown error during analysis'
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * GET endpoint para obtener información del análisis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { searchParams } = new URL(request.url)
    
    const includeDetails = searchParams.get('details') === 'true'
    const zoneId = searchParams.get('zone_id')

    const supabase = await createClient()

    // Base query
    let query = supabase
      .from('zone_positions')
      .select(`
        zone_id,
        couple_id,
        position,
        is_definitive,
        updated_at,
        zones!inner(
          tournament_id,
          name
        )
      `)
      .eq('zones.tournament_id', tournamentId)

    // Filter by zone if specified
    if (zoneId) {
      query = query.eq('zone_id', zoneId)
    }

    const { data: positions, error } = await query

    if (error) {
      throw new Error(`Error fetching position data: ${error.message}`)
    }

    // Group by zones
    const zonesSummary = positions?.reduce((acc: any, pos: any) => {
      const zoneId = pos.zone_id
      if (!acc[zoneId]) {
        acc[zoneId] = {
          zone_id: zoneId,
          zone_name: pos.zones.name,
          total_couples: 0,
          definitive_positions: 0,
          last_updated: null
        }
      }
      
      acc[zoneId].total_couples++
      if (pos.is_definitive) {
        acc[zoneId].definitive_positions++
      }
      
      // Track most recent update
      if (!acc[zoneId].last_updated || pos.updated_at > acc[zoneId].last_updated) {
        acc[zoneId].last_updated = pos.updated_at
      }
      
      return acc
    }, {}) || {}

    const summary = Object.values(zonesSummary)
    const totalCouples = summary.reduce((sum: number, zone: any) => sum + zone.total_couples, 0)
    const totalDefinitive = summary.reduce((sum: number, zone: any) => sum + zone.definitive_positions, 0)

    const response = {
      success: true,
      tournament_id: tournamentId,
      total_couples: totalCouples,
      definitive_positions: totalDefinitive,
      non_definitive_positions: totalCouples - totalDefinitive,
      zones_summary: summary,
      ...(includeDetails && { detailed_positions: positions })
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('[OPTIMIZED-ANALYSIS-GET] ❌ Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Error fetching analysis data' 
      },
      { status: 500 }
    )
  }
}