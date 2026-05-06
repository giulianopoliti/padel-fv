/**
 * 🧪 TEST SCRIPT PARA player-organizador.ts
 * 
 * Script para probar la función checkAndSetPlayerOrganizador
 * antes de implementarla en producción.
 * 
 * Para usar:
 * 1. Reemplazar PLAYER_ID y TOURNAMENT_ID con valores reales
 * 2. Ejecutar en contexto de servidor (puede ser una ruta API temporal)
 * 3. Revisar logs en consola
 */

import { 
  checkAndSetPlayerOrganizador, 
  checkAndSetMultiplePlayersOrganizador,
  getTournamentOrganizadorInfo,
  type PlayerOrganizadorResult 
} from './player-organizador'

/**
 * 🔍 TEST 1: Función básica con un jugador
 */
export async function testBasicFunction() {
  console.log('\n🧪 ===== TEST 1: Función Básica =====')
  
  // ⚠️ REEMPLAZAR CON IDs REALES DE TU BASE DE DATOS
  const PLAYER_ID = 'REEMPLAZAR_CON_PLAYER_ID_REAL'
  const TOURNAMENT_ID = 'REEMPLAZAR_CON_TOURNAMENT_ID_REAL'
  
  try {
    const result = await checkAndSetPlayerOrganizador(PLAYER_ID, TOURNAMENT_ID)
    console.log('✅ Resultado:', result)
    
    if (result.success) {
      console.log(`✅ Operación exitosa: ${result.message}`)
      console.log(`📋 Organizador ID: ${result.organizador_id}`)
      console.log(`🏢 Club ID: ${result.club_id}`)
      console.log(`🔄 Actualizado: ${result.updated}`)
    } else {
      console.error(`❌ Error: ${result.error}`)
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

/**
 * 🔍 TEST 2: Función con opciones avanzadas
 */
export async function testAdvancedOptions() {
  console.log('\n🧪 ===== TEST 2: Opciones Avanzadas =====')
  
  const PLAYER_ID = 'REEMPLAZAR_CON_PLAYER_ID_REAL'
  const TOURNAMENT_ID = 'REEMPLAZAR_CON_TOURNAMENT_ID_REAL'
  const USER_ID = 'REEMPLAZAR_CON_USER_ID_REAL' // Usuario tipo CLUB
  
  try {
    const result = await checkAndSetPlayerOrganizador(PLAYER_ID, TOURNAMENT_ID, {
      force: false,
      handleClubId: true,
      currentUserId: USER_ID,
      currentUserRole: 'CLUB'
    })
    
    console.log('✅ Resultado con opciones avanzadas:', result)
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

/**
 * 🔍 TEST 3: Múltiples jugadores
 */
export async function testMultiplePlayers() {
  console.log('\n🧪 ===== TEST 3: Múltiples Jugadores =====')
  
  const PLAYER_IDS = [
    'REEMPLAZAR_CON_PLAYER_ID_1',
    'REEMPLAZAR_CON_PLAYER_ID_2',
    'REEMPLAZAR_CON_PLAYER_ID_3'
  ]
  const TOURNAMENT_ID = 'REEMPLAZAR_CON_TOURNAMENT_ID_REAL'
  
  try {
    const result = await checkAndSetMultiplePlayersOrganizador(PLAYER_IDS, TOURNAMENT_ID, {
      continueOnError: true
    })
    
    console.log('✅ Resultado múltiples jugadores:', {
      success: result.success,
      processed: result.processed,
      updated: result.updated,
      failed: result.failed
    })
    
    // Mostrar detalles de cada jugador
    result.results.forEach((res, index) => {
      console.log(`  Jugador ${index + 1}: ${res.success ? '✅' : '❌'} ${res.message}`)
    })
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

/**
 * 🔍 TEST 4: Información del organizador del torneo
 */
export async function testTournamentInfo() {
  console.log('\n🧪 ===== TEST 4: Info del Torneo =====')
  
  const TOURNAMENT_ID = 'REEMPLAZAR_CON_TOURNAMENT_ID_REAL'
  
  try {
    const info = await getTournamentOrganizadorInfo(TOURNAMENT_ID)
    console.log('✅ Información del torneo:', info)
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

/**
 * 🔍 TEST 5: Caso con jugador que ya tiene organizador
 */
export async function testPlayerWithExistingOrganizador() {
  console.log('\n🧪 ===== TEST 5: Jugador con Organizador Existente =====')
  
  const PLAYER_ID = 'REEMPLAZAR_CON_PLAYER_ID_CON_ORGANIZADOR'
  const TOURNAMENT_ID = 'REEMPLAZAR_CON_TOURNAMENT_ID_REAL'
  
  try {
    // Test sin force
    console.log('🔸 Test sin force:')
    const result1 = await checkAndSetPlayerOrganizador(PLAYER_ID, TOURNAMENT_ID, {
      force: false
    })
    console.log('   Resultado:', result1.message, '| Actualizado:', result1.updated)
    
    // Test con force
    console.log('🔸 Test con force:')
    const result2 = await checkAndSetPlayerOrganizador(PLAYER_ID, TOURNAMENT_ID, {
      force: true
    })
    console.log('   Resultado:', result2.message, '| Actualizado:', result2.updated)
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

/**
 * 🚀 EJECUTAR TODOS LOS TESTS
 */
export async function runAllTests() {
  console.log('🧪 ===== INICIANDO TESTS DE player-organizador.ts =====')
  
  await testTournamentInfo()
  await testBasicFunction()
  await testAdvancedOptions()
  await testMultiplePlayers()
  await testPlayerWithExistingOrganizador()
  
  console.log('\n✅ ===== TESTS COMPLETADOS =====')
}

/**
 * 📋 FUNCIÓN PARA OBTENER IDs DE PRUEBA DE LA BASE DE DATOS
 * Útil para obtener IDs reales antes de ejecutar los tests
 */
export async function getTestIds() {
  console.log('\n📋 ===== OBTENIENDO IDs DE PRUEBA =====')
  
  try {
    const { createClient } = await import('@/utils/supabase/server')
    const supabase = await createClient()
    
    // Obtener un torneo de prueba
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, organization_id')
      .limit(3)
    
    console.log('🏆 Torneos disponibles:')
    tournaments?.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.id} - ${t.name} (org: ${t.organization_id})`)
    })
    
    // Obtener jugadores de prueba
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, organizador_id, club_id')
      .limit(5)
    
    console.log('\n👤 Jugadores disponibles:')
    players?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.id} - ${p.first_name} ${p.last_name} (org: ${p.organizador_id}, club: ${p.club_id})`)
    })
    
    // Obtener usuarios tipo CLUB
    const { data: clubUsers } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', 'CLUB')
      .limit(3)
    
    console.log('\n🏢 Usuarios CLUB disponibles:')
    clubUsers?.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.id} - ${u.email}`)
    })
    
  } catch (error) {
    console.error('❌ Error obteniendo IDs:', error)
  }
}

// Ejemplo de cómo crear una ruta API temporal para testing:
/*
// Crear archivo: /app/api/test-organizador/route.ts

import { runAllTests, getTestIds } from '@/utils/test-player-organizador'

export async function GET() {
  await getTestIds()
  await runAllTests()
  
  return Response.json({ message: 'Tests completados - revisar consola' })
}
*/