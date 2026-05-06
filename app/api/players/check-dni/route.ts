import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 🔍 API ENDPOINT: Verificar DNI existente
 *
 * GET /api/players/check-dni?dni=12345678
 *
 * Verifica si existe un jugador con el DNI proporcionado.
 * Usado por el formulario de creación de jugadores para validar duplicados.
 *
 * @returns {exists: boolean, player: PlayerInfo | null}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dni = searchParams.get('dni')

    if (!dni) {
      return NextResponse.json(
        { error: 'DNI es requerido' },
        { status: 400 }
      )
    }

    // Limpiar DNI (remover espacios, puntos, etc.)
    const cleanDni = dni.trim().replace(/\D/g, '')

    if (cleanDni.length < 7) {
      return NextResponse.json(
        { error: 'DNI debe tener al menos 7 dígitos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar jugador por DNI
    const { data: player, error } = await supabase
      .from('players')
      .select('id, first_name, last_name, dni, score, category_name, gender')
      .eq('dni', cleanDni)
      .maybeSingle()

    if (error) {
      console.error('[check-dni] Error querying player:', error)
      return NextResponse.json(
        { error: 'Error al verificar DNI en la base de datos' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      exists: !!player,
      player: player || null
    })

  } catch (error) {
    console.error('[check-dni] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
