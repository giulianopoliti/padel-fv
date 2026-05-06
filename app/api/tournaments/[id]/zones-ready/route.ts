import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * API endpoint simple para verificar si las zonas están listas
 * 
 * GET /api/tournaments/[id]/zones-ready
 * - Para testing: siempre retorna ready=true si hay parejas con posiciones de zona
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

    // Contar parejas con posiciones de zona definidas
    const { data: zonePositions, error } = await supabase
      .from('zone_positions')
      .select('couple_id, position, zone_id')
      .eq('tournament_id', tournamentId)
      .eq('is_definitive', true)

    if (error) {
      console.error('[zones-ready] Error fetching zone positions:', error)
      return NextResponse.json({
        ready: false,
        message: 'Error verificando estado de zonas',
        totalCouples: 0,
        zonesCount: 0
      })
    }

    const totalCouples = zonePositions?.length || 0
    const zonesCount = new Set(zonePositions?.map(p => p.zone_id)).size

    // Para testing: permitir generar bracket si hay al menos 4 parejas
    const isReady = totalCouples >= 4
    
    return NextResponse.json({
      ready: isReady,
      message: isReady 
        ? `${totalCouples} parejas listas para eliminación` 
        : `Solo ${totalCouples} parejas con posición definida (mínimo 4)`,
      totalCouples,
      zonesCount,
      debug: true // Indicar que es modo debug
    })

  } catch (error: any) {
    console.error('[zones-ready] Error:', error)
    return NextResponse.json({
      ready: false,
      message: 'Error verificando zonas',
      totalCouples: 0,
      zonesCount: 0,
      error: error.message
    }, { status: 500 })
  }
}