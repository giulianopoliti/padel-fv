import { NextRequest, NextResponse } from 'next/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { createClient } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const tournamentId = resolvedParams.id
    
    if (!tournamentId) {
      return NextResponse.json(
        { error: 'ID de torneo requerido' },
        { status: 400 }
      )
    }

    // Check tournament permissions
    const permissions = await checkTournamentPermissions(user.id, tournamentId)
    
    return NextResponse.json(permissions)
    
  } catch (error) {
    console.error('Error checking tournament permissions:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}