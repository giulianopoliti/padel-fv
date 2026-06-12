import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getActiveDisqualifications } from '@/lib/services/tournament-disqualifications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const phase = request.nextUrl.searchParams.get('phase')
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const disqualifications = await getActiveDisqualifications(
      tournamentId,
      supabase,
      phase === 'ZONE_PHASE' || phase === 'BRACKET_PHASE' ? phase : undefined
    )

    return NextResponse.json({ success: true, disqualifications })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error obteniendo descalificaciones'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
