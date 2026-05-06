import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createApiResponse } from "@/utils/serialization"

// Import shouldTournamentUseNewSystem function
async function shouldTournamentUseNewSystem(tournamentId: string): Promise<boolean> {
  const supabase = await createClient()
  
  // 1. Verificar si existe la tabla zone_positions
  let hasZonePositionsTable = false
  try {
    await supabase.from('zone_positions').select('id').limit(1)
    hasZonePositionsTable = true
  } catch (error) {
    hasZonePositionsTable = false
  }

  if (!hasZonePositionsTable) {
    return false // Sin tabla, usar legacy
  }

  // 2. Obtener información del torneo
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_at')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    return false // Sin torneo, usar legacy
  }

  // 3. Verificar si ya tiene datos en zone_positions
  const { data: zonePositions } = await supabase
    .from('zone_positions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)
  
  const hasZonePositionsData = zonePositions && zonePositions.length > 0

  // 4. Aplicar la misma lógica que system-type
  const tournamentCreatedAt = new Date(tournament.created_at)
  const cutoffDate = new Date('2025-08-14')
  
  // Usar nuevo sistema si:
  // - Tiene datos en zone_positions, O  
  // - Es un torneo creado después del cutoff
  return hasZonePositionsData ||
         tournamentCreatedAt >= cutoffDate
}

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, zoneId } = await req.json()
    
    const supabase = await createClient()
    
    // Remove couple from zone_couples
    const { error } = await supabase
      .from("zone_couples")
      .delete()
      .eq("zone_id", zoneId)
      .eq("couple_id", coupleId)
    
    if (error) {
      return NextResponse.json(
        createApiResponse({ success: false, message: error.message }), 
        { status: 400 }
      )
    }

    // NUEVO: También eliminar de zone_positions para nuevo sistema
    const shouldUseNewSystem = await shouldTournamentUseNewSystem(tournamentId)
    if (shouldUseNewSystem) {
      const { error: positionError } = await supabase
        .from("zone_positions")
        .delete()
        .eq("zone_id", zoneId)
        .eq("couple_id", coupleId)
        .eq("tournament_id", tournamentId)
      
      if (positionError) {
        console.error('[remove-couple] Error removing from zone_positions:', positionError)
      }
      
      // Reordenar posiciones de parejas restantes en la zona
      const { data: remainingCouples } = await supabase
        .from("zone_positions")
        .select("id, position")
        .eq("zone_id", zoneId)
        .eq("tournament_id", tournamentId)
        .order("position")
      
      if (remainingCouples && remainingCouples.length > 0) {
        const updates = remainingCouples.map((couple, index) => ({
          id: couple.id,
          position: index + 1
        }))
        
        for (const update of updates) {
          await supabase
            .from("zone_positions")
            .update({ position: update.position, updated_at: new Date().toISOString() })
            .eq("id", update.id)
        }
        
        console.log(`[remove-couple] ✅ Reordered ${updates.length} positions in zone ${zoneId}`)
      }
    }
    
    return NextResponse.json(createApiResponse({ success: true, message: "Pareja removida de la zona" }))
  } catch (e: any) {
    return NextResponse.json(
      createApiResponse({ success: false, message: e.message }), 
      { status: 500 }
    )
  }
}