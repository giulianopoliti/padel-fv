import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * EMERGENCY FIX ENDPOINT FOR DEFINITIVE POSITIONS PROBLEM
 * 
 * This endpoint manually applies the definitive position algorithm
 * and fixes the database inconsistency issue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    
    console.log(`🚨 [EMERGENCY-FIX] Starting emergency fix for tournament: ${tournamentId}`)

    const supabase = await createClient()
    let totalFixed = 0
    const fixes: any[] = []

    // 1. Get all zones for the tournament
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId)

    if (zonesError || !zones) {
      throw new Error(`Failed to fetch zones: ${zonesError?.message}`)
    }

    console.log(`🔍 [EMERGENCY-FIX] Found ${zones.length} zones to analyze`)

    // 2. Analyze each zone manually
    for (const zone of zones) {
      console.log(`📊 [EMERGENCY-FIX] Analyzing zone: ${zone.name}`)
      
      // Get current positions
      const { data: positions } = await supabase
        .from('zone_positions')
        .select('couple_id, position, wins, losses, is_definitive')
        .eq('zone_id', zone.id)
        .order('position')

      // Get pending matches
      const { data: pendingMatches } = await supabase
        .from('matches')
        .select('id, couple1_id, couple2_id')
        .eq('zone_id', zone.id)
        .in('status', ['PENDING', 'IN_PROGRESS'])

      if (!positions || positions.length === 0) {
        console.log(`⚠️ [EMERGENCY-FIX] No positions found for zone ${zone.name}`)
        continue
      }

      // 3. Apply manual definitive analysis
      for (const position of positions) {
        const others = positions.filter(p => p.couple_id !== position.couple_id)
        
        let shouldBeDefinitive = false
        let reason = ''
        
        // CASE 1: First place definitive (2W-0L and no one else can reach 2W)
        if (position.wins === 2 && position.losses === 0) {
          const maxWinsPossibleForOthers = Math.max(...others.map(other => {
            const pendingForOther = (pendingMatches || []).filter(m => 
              m.couple1_id === other.couple_id || m.couple2_id === other.couple_id
            ).length
            return other.wins + pendingForOther
          }))
          
          if (maxWinsPossibleForOthers < 2) {
            shouldBeDefinitive = true
            reason = `First place definitive: 2W-0L, max others can get: ${maxWinsPossibleForOthers}W`
          }
        }
        
        // CASE 2: Last place definitive (0W-2L and everyone else has at least 1W)
        if (position.wins === 0 && position.losses === 2) {
          const minWinsForOthers = Math.min(...others.map(other => other.wins))
          if (minWinsForOthers >= 1) {
            shouldBeDefinitive = true
            reason = `Last place definitive: 0W-2L, min others have: ${minWinsForOthers}W`
          }
        }
        
        // 4. Fix if needed
        if (shouldBeDefinitive && !position.is_definitive) {
          console.log(`🔧 [EMERGENCY-FIX] Fixing position ${position.position} in ${zone.name}: ${reason}`)
          
          const { error } = await supabase
            .from('zone_positions')
            .update({ 
              is_definitive: true,
              updated_at: new Date().toISOString()
            })
            .eq('zone_id', zone.id)
            .eq('couple_id', position.couple_id)
          
          if (error) {
            console.error(`❌ [EMERGENCY-FIX] Failed to fix position ${position.position}:`, error)
            fixes.push({
              zoneId: zone.id,
              zoneName: zone.name,
              position: position.position,
              status: 'FAILED',
              error: error.message,
              reason
            })
          } else {
            console.log(`✅ [EMERGENCY-FIX] Successfully fixed position ${position.position}`)
            totalFixed++
            fixes.push({
              zoneId: zone.id,
              zoneName: zone.name,
              position: position.position,
              status: 'FIXED',
              reason
            })
          }
        } else if (shouldBeDefinitive && position.is_definitive) {
          console.log(`✅ [EMERGENCY-FIX] Position ${position.position} in ${zone.name} already correct`)
          fixes.push({
            zoneId: zone.id,
            zoneName: zone.name,
            position: position.position,
            status: 'ALREADY_CORRECT',
            reason
          })
        }
      }
    }

    // 5. Final verification
    const { data: finalPositions, count: definitiveCount } = await supabase
      .from('zone_positions')
      .select('*', { count: 'exact' })
      .eq('tournament_id', tournamentId)
      .eq('is_definitive', true)

    console.log(`🎉 [EMERGENCY-FIX] Emergency fix completed: ${totalFixed} positions fixed, ${definitiveCount} total definitive positions`)

    return NextResponse.json({
      success: true,
      message: `Emergency fix completed successfully`,
      tournamentId,
      totalFixed,
      totalDefinitivePositions: definitiveCount,
      fixes,
      algorithm: 'EMERGENCY_MANUAL_FIX'
    })

  } catch (error: any) {
    console.error('🚨 [EMERGENCY-FIX] Critical error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error in emergency fix' 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  return NextResponse.json({
    message: 'Emergency fix endpoint for definitive positions',
    tournament_id: tournamentId,
    usage: 'POST to apply emergency fix',
    description: 'Manually analyzes and fixes definitive positions that are not being properly detected by the automated system'
  })
}