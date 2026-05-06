import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

/**
 * API para detectar qué tipo de sistema de zonas usa un torneo
 * 
 * Sistema Legacy: Usa tablas zones + zone_couples
 * Sistema Nuevo: Usa tabla zone_positions + nuevas funcionalidades
 * 
 * Detección basada en campo explícito `uses_new_system` en tournaments table.
 * Fallback: Si no hay campo, usar detección legacy por seguridad.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tournamentId } = await params
    const supabase = await createClient()
    
    // Verificar que el torneo existe y obtener campo uses_new_system
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, created_at, uses_new_system')
      .eq('id', tournamentId)
      .single()
    
    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Por ahora, verificar si existe la tabla zone_positions
    // Si no existe, definitivamente es legacy
    let hasZonePositionsTable = false
    try {
      await supabase.from('zone_positions').select('id').limit(1)
      hasZonePositionsTable = true
    } catch (error) {
      // Tabla no existe, es legacy
      hasZonePositionsTable = false
    }

    // Si la tabla existe, verificar si este torneo específico tiene datos en zone_positions
    let hasZonePositionsData = false
    if (hasZonePositionsTable) {
      const { data: zonePositions } = await supabase
        .from('zone_positions')
        .select('id')
        .eq('tournament_id', tournamentId)
        .limit(1)
      
      hasZonePositionsData = Boolean(zonePositions && zonePositions.length > 0)
    }

    // Lógica de detección basada en campo explícito:
    // 1. Si el campo uses_new_system existe, usarlo directamente
    // 2. Si no existe el campo, verificar infraestructura como fallback
    // 3. En caso de duda, usar legacy (más seguro)
    
    let isLegacy = true; // Default seguro
    let detectionReason = 'DEFAULT_FALLBACK';
    
    // Campo uses_new_system ahora existe en main, usar su valor directamente
    isLegacy = !tournament.uses_new_system;
    detectionReason = tournament.uses_new_system ? 'EXPLICIT_NEW' : 'EXPLICIT_LEGACY';

    return NextResponse.json({ 
      isLegacy,
      metadata: {
        tournamentId,
        hasZonePositionsTable,
        hasZonePositionsData,
        tournamentCreatedAt: tournament.created_at,
        usesNewSystemField: tournament.uses_new_system,
        detectionReason,
        detectionTime: new Date().toISOString()
      }
    })
  } catch (error: any) {
    console.error('[system-type API] Error:', error)
    
    // En caso de error, asumir legacy (más seguro)
    return NextResponse.json({ 
      isLegacy: true,
      error: 'Detection failed, defaulting to legacy',
      details: error.message
    })
  }
}