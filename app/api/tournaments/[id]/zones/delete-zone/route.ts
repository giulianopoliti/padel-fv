import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createApiResponse } from "@/utils/serialization"

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { zoneId } = await req.json()
    
    if (!zoneId || typeof zoneId !== 'string') {
      return NextResponse.json(
        createApiResponse({ success: false, message: "ID de zona requerido" }), 
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // 1. Verify zone belongs to tournament
    const { data: zone, error: zoneError } = await supabase
      .from("zones")
      .select("id, name, tournament_id")
      .eq("id", zoneId)
      .eq("tournament_id", tournamentId)
      .single()
    
    if (zoneError || !zone) {
      return NextResponse.json(
        createApiResponse({ success: false, message: "Zona no encontrada" }), 
        { status: 404 }
      )
    }
    
    // 2. Check if zone is empty (no couples assigned)
    const { count: couplesCount, error: countError } = await supabase
      .from("zone_positions")  // ✅ Cambio: leer de zone_positions
      .select("*", { head: true, count: "exact" })
      .eq("zone_id", zoneId)
    
    if (countError) {
      console.error('[deleteZone] Error counting couples:', countError)
      return NextResponse.json(
        createApiResponse({ success: false, message: "Error verificando parejas en la zona" }), 
        { status: 500 }
      )
    }
    
    if ((couplesCount || 0) > 0) {
      return NextResponse.json(
        createApiResponse({ 
          success: false, 
          message: `No se puede eliminar "${zone.name}" porque tiene ${couplesCount} pareja${couplesCount !== 1 ? 's' : ''} asignada${couplesCount !== 1 ? 's' : ''}` 
        }), 
        { status: 400 }
      )
    }
    
    // 3. Delete the zone (it's empty)
    const { error: deleteError } = await supabase
      .from("zones")
      .delete()
      .eq("id", zoneId)
      .eq("tournament_id", tournamentId)
    
    if (deleteError) {
      console.error('[deleteZone] Delete error:', deleteError)
      return NextResponse.json(
        createApiResponse({ success: false, message: deleteError.message }), 
        { status: 400 }
      )
    }
    
    return NextResponse.json(createApiResponse({ 
      success: true, 
      message: `Zona "${zone.name}" eliminada exitosamente`,
      deletedZoneId: zoneId
    }))
  } catch (e: any) {
    console.error('[deleteZone] Unexpected error:', e)
    return NextResponse.json(
      createApiResponse({ success: false, message: e.message }), 
      { status: 500 }
    )
  }
}