import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createApiResponse } from "@/utils/serialization"

export async function POST(
  req: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { name, capacity = 4 } = await req.json()
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        createApiResponse({ success: false, message: "Nombre de zona requerido" }), 
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // Check if zone name already exists in this tournament (check both languages)
    const { data: existingZones, error: checkError } = await supabase
      .from("zones")
      .select("id, name")
      .eq("tournament_id", tournamentId)
    
    if (checkError) {
      console.error('[addZone] Error checking existing zones:', checkError)
      return NextResponse.json(
        createApiResponse({ success: false, message: "Error verificando zonas existentes" }), 
        { status: 500 }
      )
    }
    
    // Check for collision with both Spanish and English versions
    const normalizedNewName = name.toLowerCase()
    const conflicts = existingZones?.filter(zone => {
      const existingName = zone.name.toLowerCase()
      
      // Check exact match
      if (existingName === normalizedNewName) {
        return true
      }
      
      // Check if trying to create Spanish version when English exists (or vice versa)
      if (normalizedNewName.startsWith('zona ') && existingName.startsWith('zone ')) {
        const newLetter = normalizedNewName.replace('zona ', '')
        const existingLetter = existingName.replace('zone ', '')
        return newLetter === existingLetter
      }
      
      if (normalizedNewName.startsWith('zone ') && existingName.startsWith('zona ')) {
        const newLetter = normalizedNewName.replace('zone ', '')
        const existingLetter = existingName.replace('zona ', '')
        return newLetter === existingLetter
      }
      
      return false
    })
    
    if (conflicts && conflicts.length > 0) {
      const conflictName = conflicts[0].name
      return NextResponse.json(
        createApiResponse({ 
          success: false, 
          message: `Ya existe una zona similar: "${conflictName}". No se puede crear "${name}".` 
        }), 
        { status: 400 }
      )
    }
    
    // Create new zone
    const { data: newZone, error } = await supabase
      .from("zones")
      .insert({
        tournament_id: tournamentId,
        name: name.trim(),
        capacity: capacity
      })
      .select()
      .single()
    
    if (error) {
      console.error('[addZone] Database error:', error)
      return NextResponse.json(
        createApiResponse({ success: false, message: error.message }), 
        { status: 400 }
      )
    }
    
    return NextResponse.json(createApiResponse({ 
      success: true, 
      message: `Zona "${name}" creada exitosamente`,
      zone: {
        id: newZone.id,
        name: newZone.name,
        capacity: newZone.capacity,
        createdAt: newZone.created_at,
        couples: []
      }
    }))
  } catch (e: any) {
    console.error('[addZone] Unexpected error:', e)
    return NextResponse.json(
      createApiResponse({ success: false, message: e.message }), 
      { status: 500 }
    )
  }
}