import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { createInscriptionProofSignedUrl } from '@/lib/services/inscription-proofs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inscriptionId: string }> }
) {
  try {
    const { id: tournamentId, inscriptionId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const permissionCheck = await checkTournamentPermissions(user.id, tournamentId)
    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { success: false, message: permissionCheck.reason || 'Sin permisos' },
        { status: 403 }
      )
    }

    const { data: inscription, error } = await supabase
      .from('inscriptions')
      .select('id, tournament_id, payment_proof_path')
      .eq('id', inscriptionId)
      .eq('tournament_id', tournamentId)
      .single()

    if (error || !inscription?.payment_proof_path) {
      return NextResponse.json(
        { success: false, message: 'No se encontró comprobante para esta inscripción' },
        { status: 404 }
      )
    }

    const signedUrlResult = await createInscriptionProofSignedUrl(inscription.payment_proof_path)
    if (!signedUrlResult.success) {
      return NextResponse.json(
        { success: false, message: signedUrlResult.error || 'No se pudo generar la URL del comprobante' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: signedUrlResult.signedUrl,
    })
  } catch (error) {
    console.error('[inscription-proof] Unexpected error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
