/**
 * 🧪 API ROUTE PARA TESTING DE player-organizador.ts
 * 
 * Ruta temporal para probar las funciones de asignación de organizador
 * 
 * Uso:
 * 1. GET /api/test-organizador - Ejecuta todos los tests
 * 2. GET /api/test-organizador?action=ids - Solo obtiene IDs de prueba
 * 3. GET /api/test-organizador?action=single&playerId=xxx&tournamentId=xxx - Test específico
 */

import { NextRequest } from 'next/server'
import { 
  checkAndSetPlayerOrganizador, 
  checkAndSetMultiplePlayersOrganizador,
  getTournamentOrganizadorInfo 
} from '@/utils/player-organizador'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'all'

  console.log(`\n🧪 ===== INICIANDO TEST API - Action: ${action} =====`)

  try {
    if (action === 'ids') {
      return await getTestIds()
    } else if (action === 'single') {
      return await testSinglePlayer(searchParams)
    } else if (action === 'info') {
      return await testTournamentInfo(searchParams)
    } else {
      return await runFullTests()
    }
  } catch (error) {
    console.error('❌ Error en test API:', error)
    return Response.json({ 
      error: 'Error ejecutando tests', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

/**
 * 📋 Obtener IDs de prueba de la base de datos
 */
async function getTestIds() {
  console.log('\n📋 ===== OBTENIENDO IDs DE PRUEBA =====')
  
  const supabase = await createClient()
  const results: any = {}

  try {
    // Obtener torneos con organization_id
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select(`
        id, 
        name, 
        organization_id,
        organizaciones:organization_id (
          id,
          name
        )
      `)
      .not('organization_id', 'is', null)
      .limit(3)

    if (tournamentsError) {
      console.error('Error obteniendo torneos:', tournamentsError)
    } else {
      results.tournaments = tournaments
      console.log('🏆 Torneos con organizador:')
      tournaments?.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.id} - ${t.name}`)
        console.log(`      Organizador: ${t.organizaciones?.name || 'N/A'} (${t.organization_id})`)
      })
    }

    // Obtener jugadores (algunos con organizador, otros sin)
    const { data: playersWithOrg } = await supabase
      .from('players')
      .select('id, first_name, last_name, organizador_id, club_id')
      .not('organizador_id', 'is', null)
      .limit(3)

    const { data: playersWithoutOrg } = await supabase
      .from('players')
      .select('id, first_name, last_name, organizador_id, club_id')
      .is('organizador_id', null)
      .limit(3)

    results.playersWithOrganizador = playersWithOrg
    results.playersWithoutOrganizador = playersWithoutOrg

    console.log('\n👤 Jugadores CON organizador:')
    playersWithOrg?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.id} - ${p.first_name} ${p.last_name} (org: ${p.organizador_id})`)
    })

    console.log('\n👤 Jugadores SIN organizador:')
    playersWithoutOrg?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.id} - ${p.first_name} ${p.last_name} (org: ${p.organizador_id})`)
    })

    // Obtener usuarios CLUB
    const { data: clubUsers } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        role,
        clubes:id (
          id,
          name
        )
      `)
      .eq('role', 'CLUB')
      .limit(3)

    results.clubUsers = clubUsers
    console.log('\n🏢 Usuarios CLUB:')
    clubUsers?.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.id} - ${u.email}`)
    })

    return Response.json({
      success: true,
      message: 'IDs obtenidos - revisar consola para detalles',
      data: results
    })

  } catch (error) {
    console.error('❌ Error obteniendo IDs:', error)
    return Response.json({ 
      error: 'Error obteniendo IDs de prueba', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

/**
 * 🔍 Test de un jugador específico
 */
async function testSinglePlayer(searchParams: URLSearchParams) {
  const playerId = searchParams.get('playerId')
  const tournamentId = searchParams.get('tournamentId')
  const force = searchParams.get('force') === 'true'
  const handleClubId = searchParams.get('handleClubId') === 'true'
  const currentUserId = searchParams.get('currentUserId')
  const currentUserRole = searchParams.get('currentUserRole')

  if (!playerId || !tournamentId) {
    return Response.json({ 
      error: 'Faltan parámetros: playerId y tournamentId son requeridos' 
    }, { status: 400 })
  }

  console.log(`\n🔍 ===== TEST JUGADOR ESPECÍFICO =====`)
  console.log(`Jugador: ${playerId}`)
  console.log(`Torneo: ${tournamentId}`)
  console.log(`Opciones: force=${force}, handleClubId=${handleClubId}`)

  try {
    const result = await checkAndSetPlayerOrganizador(playerId, tournamentId, {
      force,
      handleClubId,
      currentUserId: currentUserId || undefined,
      currentUserRole: currentUserRole || undefined
    })

    console.log('✅ Resultado:', result)

    return Response.json({
      success: true,
      message: 'Test de jugador específico completado',
      result
    })

  } catch (error) {
    console.error('❌ Error en test específico:', error)
    return Response.json({ 
      error: 'Error en test específico', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

/**
 * 🏆 Test de información del torneo
 */
async function testTournamentInfo(searchParams: URLSearchParams) {
  const tournamentId = searchParams.get('tournamentId')

  if (!tournamentId) {
    return Response.json({ 
      error: 'Falta parámetro: tournamentId es requerido' 
    }, { status: 400 })
  }

  console.log(`\n🏆 ===== TEST INFO TORNEO =====`)
  console.log(`Torneo: ${tournamentId}`)

  try {
    const info = await getTournamentOrganizadorInfo(tournamentId)
    console.log('✅ Información del torneo:', info)

    return Response.json({
      success: true,
      message: 'Información del torneo obtenida',
      data: info
    })

  } catch (error) {
    console.error('❌ Error obteniendo info del torneo:', error)
    return Response.json({ 
      error: 'Error obteniendo información del torneo', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

/**
 * 🚀 Ejecutar tests completos con datos reales
 */
async function runFullTests() {
  console.log('\n🚀 ===== EJECUTANDO TESTS COMPLETOS =====')
  
  const supabase = await createClient()
  const testResults: any = {}

  try {
    // 1. Obtener datos de prueba
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, organization_id')
      .not('organization_id', 'is', null)
      .limit(2)

    const { data: playersWithoutOrg } = await supabase
      .from('players')
      .select('id, first_name, last_name, organizador_id')
      .is('organizador_id', null)
      .limit(2)

    const { data: playersWithOrg } = await supabase
      .from('players')
      .select('id, first_name, last_name, organizador_id')
      .not('organizador_id', 'is', null)
      .limit(2)

    if (!tournaments?.length || !playersWithoutOrg?.length) {
      return Response.json({ 
        error: 'No hay datos suficientes para tests (necesita torneos con organizador y jugadores sin organizador)' 
      }, { status: 400 })
    }

    const testTournament = tournaments[0]
    const playerWithoutOrg = playersWithoutOrg[0]
    const playerWithOrg = playersWithOrg?.[0]

    console.log(`🎯 Usando torneo: ${testTournament.name} (${testTournament.id})`)
    console.log(`🎯 Jugador sin org: ${playerWithoutOrg.first_name} ${playerWithoutOrg.last_name}`)
    if (playerWithOrg) {
      console.log(`🎯 Jugador con org: ${playerWithOrg.first_name} ${playerWithOrg.last_name}`)
    }

    // 2. Test básico - jugador sin organizador
    console.log('\n🧪 Test 1: Jugador sin organizador')
    const test1 = await checkAndSetPlayerOrganizador(playerWithoutOrg.id, testTournament.id)
    testResults.test1_player_without_org = test1
    console.log('   Resultado:', test1.success ? '✅' : '❌', test1.message)

    // 3. Test - mismo jugador otra vez (debería decir que ya tiene)
    console.log('\n🧪 Test 2: Mismo jugador otra vez (sin force)')
    const test2 = await checkAndSetPlayerOrganizador(playerWithoutOrg.id, testTournament.id)
    testResults.test2_same_player_no_force = test2
    console.log('   Resultado:', test2.success ? '✅' : '❌', test2.message)
    console.log('   Actualizado:', test2.updated)

    // 4. Test con force
    console.log('\n🧪 Test 3: Mismo jugador con force=true')
    const test3 = await checkAndSetPlayerOrganizador(playerWithoutOrg.id, testTournament.id, { force: true })
    testResults.test3_same_player_with_force = test3
    console.log('   Resultado:', test3.success ? '✅' : '❌', test3.message)
    console.log('   Actualizado:', test3.updated)

    // 5. Test con jugador que ya tiene organizador (si existe)
    if (playerWithOrg) {
      console.log('\n🧪 Test 4: Jugador que ya tiene organizador')
      const test4 = await checkAndSetPlayerOrganizador(playerWithOrg.id, testTournament.id)
      testResults.test4_player_with_existing_org = test4
      console.log('   Resultado:', test4.success ? '✅' : '❌', test4.message)
      console.log('   Actualizado:', test4.updated)
    }

    // 6. Test múltiples jugadores
    if (playersWithoutOrg.length > 1) {
      console.log('\n🧪 Test 5: Múltiples jugadores')
      const playerIds = playersWithoutOrg.slice(0, 2).map(p => p.id)
      const test5 = await checkAndSetMultiplePlayersOrganizador(playerIds, testTournament.id)
      testResults.test5_multiple_players = {
        success: test5.success,
        processed: test5.processed,
        updated: test5.updated,
        failed: test5.failed
      }
      console.log('   Resultado:', test5.success ? '✅' : '❌', 
                  `Procesados: ${test5.processed}, Actualizados: ${test5.updated}, Fallos: ${test5.failed}`)
    }

    console.log('\n✅ ===== TESTS COMPLETADOS =====')

    return Response.json({
      success: true,
      message: 'Tests completados exitosamente - revisar consola para detalles completos',
      summary: {
        tournament_used: `${testTournament.name} (${testTournament.id})`,
        tests_executed: Object.keys(testResults).length,
        all_tests_successful: Object.values(testResults).every((r: any) => r.success)
      },
      detailed_results: testResults
    })

  } catch (error) {
    console.error('❌ Error en tests completos:', error)
    return Response.json({ 
      error: 'Error ejecutando tests completos', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}