import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

// NOTA: Este endpoint funciona con la branch develop-zones de Supabase
// para acceder a la tabla player_recategorizations

interface RecategorizationRecord {
  id: string
  created_at: string
  player_id: string
  player_name: string
  old_category_name: string
  new_category_name: string
  old_score: number
  new_score: number
  recategorized_by: string
  recategorizer_name: string
  reason: string | null
  tournament_context: boolean
}

interface RecategorizationHistoryResponse {
  success: boolean
  records?: RecategorizationRecord[]
  total?: number
  error?: string
}

/**
 * GET: Obtener historial de recategorizaciones del torneo
 * Solo accesible por el club owner del torneo o admins
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<RecategorizationHistoryResponse>> {
  
  const tournamentId = params.id
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100) // Máximo 100
  const offset = Number(searchParams.get('offset')) || 0
  const playerId = searchParams.get('playerId') // Filtro opcional por jugador
  
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - Usuario no encontrado'
      }, { status: 401 })
    }

    // Verificar permisos usando la función centralizada
    const permissionCheck = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.reason || 'No autorizado - No tienes permisos para ver este historial'
      }, { status: 403 })
    }

    // Construir query base
    let query = supabase
      .from('player_recategorizations')
      .select(`
        id,
        created_at,
        player_id,
        old_category_name,
        new_category_name,
        old_score,
        new_score,
        recategorized_by,
        reason,
        tournament_context,
        players!inner (
          first_name,
          last_name
        ),
        users!recategorized_by (
          email
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('es_prueba', false)
      .order('created_at', { ascending: false })

    // Filtro opcional por jugador
    if (playerId) {
      query = query.eq('player_id', playerId)
    }

    // Obtener total de registros para paginación
    const { count } = await supabase
      .from('player_recategorizations')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('es_prueba', false)

    // Obtener registros con paginación
    const { data: records, error: recordsError } = await query
      .range(offset, offset + limit - 1)

    if (recordsError) {
      console.error('Error fetching recategorization history:', recordsError)
      return NextResponse.json({
        success: false,
        error: 'Error al obtener el historial de recategorizaciones'
      }, { status: 500 })
    }

    // Formatear datos
    const formattedRecords: RecategorizationRecord[] = records?.map((record: any) => ({
      id: record.id,
      created_at: record.created_at,
      player_id: record.player_id,
      player_name: `${record.players.first_name} ${record.players.last_name}`,
      old_category_name: record.old_category_name,
      new_category_name: record.new_category_name,
      old_score: record.old_score,
      new_score: record.new_score,
      recategorized_by: record.recategorized_by,
      recategorizer_name: record.users?.email || 'Usuario desconocido',
      reason: record.reason,
      tournament_context: record.tournament_context
    })) || []

    return NextResponse.json({
      success: true,
      records: formattedRecords,
      total: count || 0
    })

  } catch (error) {
    console.error('Error in recategorization-history endpoint:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

