/**
 * EMERGENCY FIX SCRIPT FOR DEFINITIVE POSITIONS
 * 
 * Este script diagnostica y arregla el problema de posiciones definitivas
 * para el torneo 9eb33d82-9602-4755-a2c5-ad9d27c69b43
 */

import { createClient } from '@/utils/supabase/server'

interface ZoneAnalysis {
  zoneId: string
  zoneName: string
  couples: Array<{
    coupleId: string
    position: number
    wins: number
    losses: number
    isDefinitive: boolean
    shouldBeDefinitive: boolean
    reason: string
  }>
}

/**
 * DIAGNÓSTICO MANUAL DEL ALGORITMO
 */
async function diagnoseProblem(): Promise<void> {
  const supabase = await createClient()
  const tournamentId = '9eb33d82-9602-4755-a2c5-ad9d27c69b43'
  
  console.log('🔍 EMERGENCY DIAGNOSTIC: Analyzing definitive positions problem')
  
  // 1. Obtener todas las zonas
  const { data: zones } = await supabase
    .from('zones')
    .select('id, name')
    .eq('tournament_id', tournamentId)

  if (!zones) {
    console.error('❌ No zones found')
    return
  }

  for (const zone of zones) {
    console.log(`\n📊 ANALYZING ZONE: ${zone.name} (${zone.id})`)
    
    // 2. Obtener posiciones actuales
    const { data: positions } = await supabase
      .from('zone_positions')
      .select('couple_id, position, wins, losses, is_definitive, updated_at')
      .eq('zone_id', zone.id)
      .order('position')

    // 3. Obtener partidos pendientes
    const { data: pendingMatches } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, status')
      .eq('zone_id', zone.id)
      .in('status', ['PENDING', 'IN_PROGRESS'])

    if (!positions) {
      console.error(`❌ No positions found for zone ${zone.name}`)
      continue
    }

    console.log(`   Positions: ${positions.length}, Pending matches: ${pendingMatches?.length || 0}`)
    
    // 4. APLICAR ALGORITMO MANUAL
    for (const position of positions) {
      const others = positions.filter(p => p.couple_id !== position.couple_id)
      
      let shouldBeDefinitive = false
      let reason = 'No es definitiva'
      
      // CASO 1: 1ER LUGAR DEFINITIVO
      if (position.wins === 2 && position.losses === 0) {
        const maxWinsPossibleForOthers = Math.max(...others.map(other => {
          const pendingForOther = (pendingMatches || []).filter(m => 
            m.couple1_id === other.couple_id || m.couple2_id === other.couple_id
          ).length
          return other.wins + pendingForOther
        }))
        
        if (maxWinsPossibleForOthers < 2) {
          shouldBeDefinitive = true
          reason = `1er lugar definitivo: 2W-0L, nadie más puede llegar a 2W (max: ${maxWinsPossibleForOthers})`
        }
      }
      
      // CASO 2: ÚLTIMO LUGAR DEFINITIVO  
      if (position.wins === 0 && position.losses === 2) {
        const minWinsForOthers = Math.min(...others.map(other => other.wins))
        if (minWinsForOthers >= 1) {
          shouldBeDefinitive = true
          reason = `Último lugar definitivo: 0W-2L, todos los demás tienen ≥1W`
        }
      }
      
      const status = shouldBeDefinitive === position.is_definitive ? '✅' : '❌ MISMATCH'
      console.log(`   Position ${position.position}: ${position.wins}W-${position.losses}L | DB: ${position.is_definitive} | Should: ${shouldBeDefinitive} ${status}`)
      console.log(`      Reason: ${reason}`)
      
      // 5. FIX THE PROBLEM IF NEEDED
      if (shouldBeDefinitive && !position.is_definitive) {
        console.log(`   🔧 FIXING: Setting position ${position.position} as definitive`)
        
        const { error } = await supabase
          .from('zone_positions')
          .update({ 
            is_definitive: true,
            updated_at: new Date().toISOString()
          })
          .eq('zone_id', zone.id)
          .eq('couple_id', position.couple_id)
        
        if (error) {
          console.error(`   ❌ Failed to fix position ${position.position}:`, error)
        } else {
          console.log(`   ✅ Successfully fixed position ${position.position}`)
        }
      }
    }
  }
  
  // 6. VERIFICAR RESULTADO FINAL
  console.log('\n🔍 FINAL VERIFICATION:')
  const { data: finalPositions } = await supabase
    .from('zone_positions')
    .select('zone_id, position, is_definitive, zones!inner(name)')
    .eq('tournament_id', tournamentId)
    .eq('is_definitive', true)
    .order('zone_id, position')
    
  console.log(`✅ Total definitive positions found: ${finalPositions?.length || 0}`)
  finalPositions?.forEach(pos => {
    const zoneName = (pos.zones as any).name
    console.log(`   Zone ${zoneName}, Position ${pos.position}: DEFINITIVE`)
  })
}

// Función para ejecutar el fix
export { diagnoseProblem }