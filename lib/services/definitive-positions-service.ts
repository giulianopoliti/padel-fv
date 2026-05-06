import { createClientServiceRole } from '@/utils/supabase/server'
import { CorrectedDefinitiveAnalyzer } from './corrected-definitive-analyzer'

/**
 * Servicio para actualizar posiciones definitivas en zone_positions
 * Extraído del API Route para uso directo en Server Actions
 */

interface DefinitivePositionsResult {
  success: boolean
  message?: string
  error?: string
  tournamentId: string
  totalUpdates: number
  zonesAnalyzed: number
  algorithmVersion: string
  performanceMetrics: any
  results: any[]
}

export async function updateDefinitivePositionsService(tournamentId: string): Promise<DefinitivePositionsResult> {
  try {
    if (!tournamentId) {
      throw new Error('Tournament ID is required')
    }

    console.log(`[UPDATE-DEFINITIVE-SERVICE] 🔍 Analyzing definitive positions for tournament: ${tournamentId}`)

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
      throw new Error('No zones found for tournament')
    }

    console.log(`[UPDATE-DEFINITIVE-SERVICE] 📊 Found ${zones.length} zones to analyze`)

    let totalUpdates = 0
    const zoneResults: any[] = []

    // 2. Inicializar analizador corregido
    const analyzer = new CorrectedDefinitiveAnalyzer()
    
    // 3. Analizar cada zona
    for (const zone of zones) {
      console.log(`[UPDATE-DEFINITIVE-SERVICE] 🔍 Analyzing zone: ${zone.name} (${zone.id})`)
      
      try {
        const analysis = await analyzer.analyzeZonePositions(zone.id)
      
        // 4. Actualizar is_definitive en base de datos
        let zoneUpdates = 0
        for (const result of analysis.analysis) {
          console.log(`[UPDATE-DEFINITIVE-SERVICE] 🔍 Updating couple ${result.coupleId} in zone ${zone.name}`)
          console.log(`[UPDATE-DEFINITIVE-SERVICE] 🔍 Setting is_definitive=${result.isDefinitive} for couple ${result.coupleId}`)
          const { error: updateError } = await supabase
            .from('zone_positions')
            .update({ 
              is_definitive: result.isDefinitive,
              updated_at: new Date().toISOString()
            })
            .eq('zone_id', zone.id)
            .eq('couple_id', result.coupleId)

          if (updateError) {
            console.error(`[UPDATE-DEFINITIVE-SERVICE] ❌ Error updating couple ${result.coupleId}:`, updateError)
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

        console.log(`[UPDATE-DEFINITIVE-SERVICE] ✅ Zone ${zone.name}: ${definitiveCount}/${analysis.analysis.length} definitive, ${zoneUpdates} updates applied`)
        
      } catch (error: any) {
        console.warn(`[UPDATE-DEFINITIVE-SERVICE] ⚠️ Zone ${zone.name} skipped: ${error.message}`)
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

    console.log(`[UPDATE-DEFINITIVE-SERVICE] 🎉 Analysis complete: ${totalUpdates} total updates applied`)

    return {
      success: true,
      message: `Corrected definitive positions analysis completed for ${zones.length} zones`,
      tournamentId,
      totalUpdates,
      zonesAnalyzed: zones.length,
      algorithmVersion: 'CORRECTED_3_LEVELS',
      performanceMetrics,
      results: zoneResults
    }

  } catch (error: any) {
    console.error('[UPDATE-DEFINITIVE-SERVICE] ❌ Error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error analyzing definitive positions',
      tournamentId,
      totalUpdates: 0,
      zonesAnalyzed: 0,
      algorithmVersion: 'CORRECTED_3_LEVELS',
      performanceMetrics: null,
      results: []
    }
  }
}
