import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * API endpoint para obtener seeds del torneo
 * 
 * GET /api/tournaments/[id]/seeds
 * - Retorna tournament_couple_seeds con información de parejas
 */
export async function GET(
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

    const supabase = await createClient()

    const { data: seeds, error } = await supabase
      .from('tournament_couple_seeds')
      .select(`
        *,
        couples:couple_id (
          id,
          player1:player1_id (
            first_name,
            last_name
          ),
          player2:player2_id (
            first_name,
            last_name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('seed', { ascending: true })

    if (error) {
      throw new Error(`Error fetching seeds: ${error.message}`)
    }

    const coupleIds = (seeds || [])
      .map(seed => seed.couple_id)
      .filter((coupleId): coupleId is string => Boolean(coupleId))

    const placeholderZoneIds = (seeds || [])
      .map(seed => seed.placeholder_zone_id)
      .filter((zoneId): zoneId is string => Boolean(zoneId))

    const {
      data: zonePositions,
      error: zonePositionsError
    } = coupleIds.length > 0
      ? await supabase
          .from('zone_positions')
          .select(`
            couple_id,
            zone_id,
            position,
            zone:zones!zone_positions_zone_id_fkey (
              id,
              name
            )
          `)
          .eq('tournament_id', tournamentId)
          .in('couple_id', coupleIds)
      : { data: [] as any[], error: null }

    if (zonePositionsError) {
      throw new Error(`Error fetching seed zone positions: ${zonePositionsError.message}`)
    }

    const {
      data: placeholderZones,
      error: placeholderZonesError
    } = placeholderZoneIds.length > 0
      ? await supabase
          .from('zones')
          .select('id, name')
          .in('id', placeholderZoneIds)
      : { data: [] as any[], error: null }

    if (placeholderZonesError) {
      throw new Error(`Error fetching placeholder zones: ${placeholderZonesError.message}`)
    }

    const positionByCoupleId = new Map<string, any>()
    ;(zonePositions || []).forEach((position: any) => {
      if (position.couple_id && !positionByCoupleId.has(position.couple_id)) {
        positionByCoupleId.set(position.couple_id, position)
      }
    })

    const zoneNameById = new Map<string, string>()
    ;(placeholderZones || []).forEach((zone: any) => {
      if (zone.id) {
        zoneNameById.set(zone.id, zone.name)
      }
    })

    const enrichedSeeds = (seeds || []).map((seed: any) => {
      const position = seed.couple_id ? positionByCoupleId.get(seed.couple_id) : null
      const positionZone = Array.isArray(position?.zone) ? position.zone[0] : position?.zone
      const placeholderZone = seed.placeholder_zone_id
        ? zoneNameById.get(seed.placeholder_zone_id)
        : null

      return {
        ...seed,
        zone_id: position?.zone_id || seed.placeholder_zone_id || null,
        zone_name: positionZone?.name || placeholderZone || null,
        zone_position: position?.position || seed.placeholder_position || null
      }
    })

    return NextResponse.json({
      success: true,
      seeds: enrichedSeeds,
      count: enrichedSeeds.length
    })

  } catch (error: any) {
    console.error('[GET /seeds] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error fetching seeds' 
      },
      { status: 500 }
    )
  }
}
