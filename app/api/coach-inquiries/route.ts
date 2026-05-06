import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Usar el cliente normal con políticas RLS configuradas
    const supabase = await createClient()
    
    // Parse request body
    const body = await request.json()
    const { name, phone, email, interest } = body

    // Validate required fields
    if (!phone || phone.trim() === "") {
      return NextResponse.json(
        { error: "El número de teléfono es obligatorio" },
        { status: 400 }
      )
    }

    // Clean and validate phone number
    const cleanPhone = phone.trim()
    
    // Insert into database
    const { data, error } = await supabase
      .from("coach_inquiries")
      .insert({
        name: name?.trim() || null,
        phone: cleanPhone,
        email: email?.trim() || null,
        interest: interest?.trim() || null,
      })
      .select()

    if (error) {
      console.error("Error inserting coach inquiry:", error)
      return NextResponse.json(
        { error: "Error al guardar la información. Inténtalo de nuevo." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: "Información enviada correctamente",
        data: data[0]
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Error processing coach inquiry:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Obtener consultas de entrenadores ordenadas por fecha más reciente
    const { data, error } = await supabase
      .from("coach_inquiries")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching coach inquiries:", error)
      return NextResponse.json(
        { error: "Error al obtener las consultas" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })

  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
} 