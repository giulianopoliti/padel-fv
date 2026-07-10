import { NextRequest, NextResponse } from 'next/server'
import { getBracketReplacementOptions } from '@/lib/services/bracket-replacement.service'
import { isBracketKey, normalizeBracketKey } from '@/lib/services/bracket-key-policy'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { createClient, createClientServiceRole } from '@/utils/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const bracketKey = normalizeBracketKey(request.nextUrl.searchParams.get('bracket_key'))

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissions.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissions.reason || 'Sin permisos para gestionar este torneo',
      }, { status: 403 })
    }

    const serviceClient = await createClientServiceRole()
    const data = await getBracketReplacementOptions(serviceClient, tournamentId, bracketKey)

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[bracket-replacements][GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error cargando opciones de reemplazo',
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const body = await request.json().catch(() => ({}))
    const bracketKey = body.bracketKey
    const outgoingCoupleId = body.outgoingCoupleId
    const incomingCoupleId = body.incomingCoupleId

    if (!isBracketKey(bracketKey)) {
      return NextResponse.json({ success: false, error: 'Llave invalida' }, { status: 400 })
    }

    if (!outgoingCoupleId || !incomingCoupleId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan pareja saliente o entrante',
      }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissions.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissions.reason || 'Sin permisos para gestionar este torneo',
      }, { status: 403 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('replace_bracket_couple_manual', {
      p_tournament_id: tournamentId,
      p_user_id: user.id,
      p_bracket_key: bracketKey,
      p_outgoing_couple_id: outgoingCoupleId,
      p_incoming_couple_id: incomingCoupleId,
    })

    if (rpcError) {
      console.error('[bracket-replacements][POST] RPC Error:', rpcError)
      return NextResponse.json({
        success: false,
        error: 'No se pudo aplicar el reemplazo',
        details: rpcError.message,
      }, { status: 500 })
    }

    if (!result?.success) {
      return NextResponse.json({
        success: false,
        error: result?.error || 'No se pudo aplicar el reemplazo',
        details: result?.details || null,
      }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      details: result.details,
    })
  } catch (error: any) {
    console.error('[bracket-replacements][POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error aplicando reemplazo',
    }, { status: 500 })
  }
}
