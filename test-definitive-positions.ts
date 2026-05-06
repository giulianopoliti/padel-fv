/**
 * Test script para el analizador de posiciones definitivas
 * Probamos con el caso real del torneo fda68505-8fe0-4bbe-a88a-3781e4ac552e
 */

import { DefinitivePositionAnalyzer } from './lib/services/definitive-position-analyzer'

async function testDefinitivePositions() {
  console.log('🧪 [TEST] Iniciando test de posiciones definitivas')
  console.log('📋 [TEST] Caso: Zona A del torneo fda68505-8fe0-4bbe-a88a-3781e4ac552e')
  console.log('🎯 [TEST] Expectativa: NINGUNA posición debería ser definitiva (hay 1 partido pendiente)')
  console.log('')
  
  const analyzer = new DefinitivePositionAnalyzer()
  const zoneId = 'db3037b0-d198-4712-bd22-efa7a9bdcca2' // Zona A
  
  try {
    // Ejecutar análisis
    const results = await analyzer.analyzeZonePositions(zoneId)
    
    console.log('📊 [TEST] RESULTADOS DEL ANÁLISIS:')
    console.log('=' .repeat(80))
    
    for (const result of results) {
      const status = result.isDefinitive ? '🔒 DEFINITIVA' : '⚠️ NO DEFINITIVA'
      
      console.log(`\n${status} - Posición ${result.currentPosition}`)
      console.log(`👥 Pareja: ${result.coupleId}`)
      console.log(`📍 Posiciones posibles: [${result.possiblePositions.join(', ')}]`)
      console.log(`🔧 Método: ${result.analysisMethod}`)
      console.log(`💬 Detalles: ${result.analysisDetails}`)
      console.log(`🎯 Confianza: ${(result.confidence * 100).toFixed(1)}%`)
    }
    
    console.log('\n' + '=' .repeat(80))
    console.log('📈 [TEST] RESUMEN:')
    
    const definitiveCount = results.filter(r => r.isDefinitive).length
    const nonDefinitiveCount = results.filter(r => !r.isDefinitive).length
    
    console.log(`✅ Posiciones definitivas: ${definitiveCount}`)
    console.log(`⚠️ Posiciones no definitivas: ${nonDefinitiveCount}`)
    console.log(`📊 Total analizadas: ${results.length}`)
    
    // Validar expectativa
    if (nonDefinitiveCount === results.length) {
      console.log('\n🎉 [TEST] ✅ ÉXITO: Todas las posiciones son NO definitivas (como esperábamos)')
    } else {
      console.log('\n❌ [TEST] FALLO: Algunas posiciones fueron marcadas como definitivas incorrectamente')
    }
    
    // Mostrar análisis detallado por pareja
    console.log('\n🔍 [TEST] ANÁLISIS DETALLADO POR PAREJA:')
    console.log('-' .repeat(80))
    
    const sortedResults = results.sort((a, b) => a.currentPosition - b.currentPosition)
    
    for (const result of sortedResults) {
      console.log(`\nPosición ${result.currentPosition}:`)
      console.log(`  Puede quedar en: ${result.possiblePositions.join(', ')}`)
      console.log(`  Razón: ${result.analysisDetails}`)
    }
    
  } catch (error) {
    console.error('❌ [TEST] Error durante el análisis:', error)
    throw error
  }
}

// Ejecutar test si es llamado directamente
if (require.main === module) {
  testDefinitivePositions()
    .then(() => {
      console.log('\n✅ [TEST] Test completado exitosamente')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ [TEST] Test falló:', error)
      process.exit(1)
    })
}

export { testDefinitivePositions }