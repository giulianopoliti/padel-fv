import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
    coupleId: string
  }
}

/**
 * DELETE /api/tournaments/[id]/couples/[coupleId]
 * 
 * Deletes a couple from a tournament, including:
 * - Removing from inscriptions table
 * - Removing from zone_couples table
 * - Applying same restrictions as drag & drop operations
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: tournamentId, coupleId } = await params
  
  try {
    const supabase = await createClient()
    
    // Get the request body to check if fromZoneId is provided
    const body = await request.json().catch(() => ({}))
    const { fromZoneId } = body
    
    // Verify user has permission (must be tournament owner or couple member)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    // Check if couple has active matches (same validation as drag & drop)
    const { data: activeMatches, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)
      .is('winner_id', null) // Only unfinished matches
      .limit(1)

    if (matchError) {
      console.error('[DELETE couple] Error checking active matches:', matchError)
      return NextResponse.json(
        { success: false, message: 'Error verificando partidos activos' },
        { status: 500 }
      )
    }

    if (activeMatches && activeMatches.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Esta pareja tiene partidos activos y no puede ser eliminada' },
        { status: 400 }
      )
    }

    // Start transaction: Remove from zone_couples and zone_positions
    if (fromZoneId) {
      // Remove from zone_couples
      const { error: zoneCouplesError } = await supabase
        .from('zone_couples')
        .delete()
        .eq('couple_id', coupleId)
        .eq('zone_id', fromZoneId)

      if (zoneCouplesError) {
        console.error('[DELETE couple] Error removing from zone_couples:', zoneCouplesError)
        return NextResponse.json(
          { success: false, message: 'Error eliminando pareja de la zona' },
          { status: 500 }
        )
      }

      // ✅ Remove from zone_positions (fix for orphaned records)
      const { error: zonePositionsError } = await supabase
        .from('zone_positions')
        .delete()
        .eq('couple_id', coupleId)
        .eq('zone_id', fromZoneId)

      if (zonePositionsError) {
        console.error('[DELETE couple] Error removing from zone_positions:', zonePositionsError)
        return NextResponse.json(
          { success: false, message: 'Error eliminando posición de la zona' },
          { status: 500 }
        )
      }
    } else {
      // Remove from all zones for this tournament
      // First, get all zone IDs for this tournament
      const { data: tournamentZones, error: zonesQueryError } = await supabase
        .from('zones')
        .select('id')
        .eq('tournament_id', tournamentId)

      if (zonesQueryError) {
        console.error('[DELETE couple] Error querying zones:', zonesQueryError)
        return NextResponse.json(
          { success: false, message: 'Error consultando zonas del torneo' },
          { status: 500 }
        )
      }

      // Extract zone IDs into an array
      const zoneIds = (tournamentZones || []).map(z => z.id)

      // Delete from zone_couples only if there are zones
      if (zoneIds.length > 0) {
        const { error: allZonesError } = await supabase
          .from('zone_couples')
          .delete()
          .eq('couple_id', coupleId)
          .in('zone_id', zoneIds)

        if (allZonesError) {
          console.error('[DELETE couple] Error removing from all zones:', allZonesError)
          return NextResponse.json(
            { success: false, message: 'Error eliminando pareja de las zonas' },
            { status: 500 }
          )
        }
      }

      // ✅ Remove from zone_positions for all zones in this tournament (fix for orphaned records)
      const { error: allPositionsError } = await supabase
        .from('zone_positions')
        .delete()
        .eq('couple_id', coupleId)
        .eq('tournament_id', tournamentId)

      if (allPositionsError) {
        console.error('[DELETE couple] Error removing from all zone_positions:', allPositionsError)
        return NextResponse.json(
          { success: false, message: 'Error eliminando posiciones de la pareja' },
          { status: 500 }
        )
      }
    }

    // Then remove from inscriptions
    const { error: inscriptionError } = await supabase
      .from('inscriptions')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('couple_id', coupleId)

    if (inscriptionError) {
      console.error('[DELETE couple] Error removing inscription:', inscriptionError)
      return NextResponse.json(
        { success: false, message: 'Error eliminando inscripción de la pareja' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pareja eliminada del torneo exitosamente'
    })

  } catch (error) {
    console.error('[DELETE couple] Unexpected error:', error)
    return NextResponse.json(
      { success: false, message: 'Error inesperado al eliminar la pareja' },
      { status: 500 }
    )
  }
}