import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface BracketSystemResponse {
  canUseSerpentine: boolean
  reason?: string
  metadata?: {
    tournamentId: string
    hasZonePositionsTable: boolean
    hasDefinitiveZonePositions: boolean
    zonesCount: number
    totalCouples: number
    detectionTime: string
  }
  error?: string
  details?: string
}

/**
 * Detects whether a tournament can use the serpentine bracket system
 * 
 * Requirements for serpentine system:
 * 1. Tournament must have zone_positions table data
 * 2. Zone positions must be definitive (all zones completed)
 * 3. Must have at least 2 zones for serpentine pattern to make sense
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<BracketSystemResponse>> {
  const tournamentId = params.id
  const detectionTime = new Date().toISOString()

  try {
    const supabase = await createClient()

    // Verificar que el torneo existe y obtener uses_new_system
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, uses_new_system')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        canUseSerpentine: false,
        error: 'Tournament not found',
        details: tournamentError?.message || 'Tournament does not exist',
        metadata: {
          tournamentId,
          hasZonePositionsTable: false,
          hasDefinitiveZonePositions: false,
          zonesCount: 0,
          totalCouples: 0,
          detectionTime
        }
      })
    }

    // Verificar si existe la tabla zone_positions y tiene datos para este torneo
    const { data: zonePositions, error: zonePositionsError } = await supabase
      .from('zone_positions')
      .select('*')
      .eq('tournament_id', tournamentId)

    if (zonePositionsError) {
      console.warn(`[BracketSystemDetection] Zone positions query failed:`, zonePositionsError.message)
      return NextResponse.json({
        canUseSerpentine: false,
        reason: 'Zone positions table not accessible',
        error: 'Database query failed',
        details: zonePositionsError.message,
        metadata: {
          tournamentId,
          hasZonePositionsTable: false,
          hasDefinitiveZonePositions: false,
          zonesCount: 0,
          totalCouples: 0,
          detectionTime
        }
      })
    }

    const hasZonePositionsData = zonePositions && zonePositions.length > 0
    const zonesCount = hasZonePositionsData ? new Set(zonePositions.map(zp => zp.zone_id)).size : 0
    const totalCouples = hasZonePositionsData ? zonePositions.length : 0

    // Verificar si las posiciones están definidas (tienen todas las posiciones definitivas)
    let hasDefinitiveZonePositions = false
    if (hasZonePositionsData) {
      // Todas las entries deben tener is_definitive = true y position válida
      const definitivePositions = zonePositions.filter(zp => 
        zp.is_definitive === true &&
        zp.position !== null && 
        typeof zp.position === 'number' && 
        zp.position > 0
      )
      hasDefinitiveZonePositions = definitivePositions.length === totalCouples
    }

    const metadata = {
      tournamentId,
      hasZonePositionsTable: true,
      hasDefinitiveZonePositions,
      zonesCount,
      totalCouples,
      detectionTime
    }

    // Condiciones para poder usar sistema serpentino:
    // 1. Tournament debe usar el nuevo sistema (uses_new_system = true)
    // 2. Debe tener datos en zone_positions
    // 3. Todas las posiciones deben estar definidas
    // 4. Debe tener al menos 2 zonas (sino serpentino no tiene sentido)
    
    if (!tournament.uses_new_system) {
      return NextResponse.json({
        canUseSerpentine: false,
        reason: 'Tournament uses legacy system (uses_new_system = false)',
        metadata
      })
    }

    if (!hasZonePositionsData) {
      return NextResponse.json({
        canUseSerpentine: false,
        reason: 'No zone positions data found for this tournament',
        metadata
      })
    }

    if (!hasDefinitiveZonePositions) {
      return NextResponse.json({
        canUseSerpentine: false,
        reason: 'Zone positions are not definitive yet (some zones may still be in progress)',
        metadata
      })
    }

    if (zonesCount < 2) {
      return NextResponse.json({
        canUseSerpentine: false,
        reason: 'Tournament needs at least 2 zones for serpentine algorithm to be meaningful',
        metadata
      })
    }

    // ✅ Tournament can use serpentine system
    return NextResponse.json({
      canUseSerpentine: true,
      reason: `Tournament has ${zonesCount} completed zones with ${totalCouples} couples - serpentine algorithm available`,
      metadata
    })

  } catch (error: any) {
    console.error('[BracketSystemDetection] Unexpected error:', error)
    
    return NextResponse.json({
      canUseSerpentine: false,
      error: 'Internal server error during bracket system detection',
      details: error.message,
      metadata: {
        tournamentId,
        hasZonePositionsTable: false,
        hasDefinitiveZonePositions: false,
        zonesCount: 0,
        totalCouples: 0,
        detectionTime
      }
    })
  }
}