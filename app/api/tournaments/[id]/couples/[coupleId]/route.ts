import { removeCoupleFromTournament } from '@/app/api/tournaments/actions'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{
    id: string
    coupleId: string
  }>
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id: tournamentId, coupleId } = await params

  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const result = await removeCoupleFromTournament(tournamentId, coupleId)
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Pareja eliminada del torneo exitosamente',
    })
  } catch (error) {
    console.error('[DELETE couple] Unexpected error:', error)
    return NextResponse.json(
      { success: false, message: 'Error inesperado al eliminar la pareja' },
      { status: 500 }
    )
  }
}
