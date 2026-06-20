import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface InscriptionSettingsPayload {
  validate_inscriptions: boolean
  enable_public_inscriptions: boolean
  show_few_slots_alert: boolean
  enable_payment_checkboxes: boolean
  enable_transfer_proof: boolean
  transfer_alias: string | null
  transfer_amount: number | null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const payload = (await request.json()) as Partial<InscriptionSettingsPayload>
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

    const { data: currentTournament, error: currentTournamentError } = await supabase
      .from('tournaments')
      .select(`
        validate_inscriptions,
        enable_public_inscriptions,
        show_few_slots_alert,
        enable_payment_checkboxes,
        enable_transfer_proof,
        transfer_alias,
        transfer_amount
      `)
      .eq('id', tournamentId)
      .single()

    if (currentTournamentError || !currentTournament) {
      return NextResponse.json(
        { success: false, message: 'No se encontro la configuracion actual del torneo' },
        { status: 404 }
      )
    }

    const validateInscriptions =
      payload.validate_inscriptions ?? currentTournament.validate_inscriptions ?? false
    const enablePublicInscriptions =
      payload.enable_public_inscriptions ?? currentTournament.enable_public_inscriptions ?? true
    const showFewSlotsAlert =
      payload.show_few_slots_alert ?? currentTournament.show_few_slots_alert ?? true
    const enablePaymentCheckboxes =
      payload.enable_payment_checkboxes ?? currentTournament.enable_payment_checkboxes ?? false
    const enableTransferProof =
      payload.enable_transfer_proof ?? currentTournament.enable_transfer_proof ?? false
    const transferAlias =
      payload.transfer_alias !== undefined
        ? payload.transfer_alias?.trim() || null
        : currentTournament.transfer_alias ?? null
    const rawAmount =
      payload.transfer_amount !== undefined
        ? payload.transfer_amount
        : currentTournament.transfer_amount
    const transferAmount =
      rawAmount === null || rawAmount === undefined || Number.isNaN(Number(rawAmount))
        ? null
        : Number(rawAmount)

    if (enableTransferProof) {
      if (!transferAlias) {
        return NextResponse.json(
          { success: false, message: 'El alias es obligatorio cuando la transferencia está activa' },
          { status: 400 }
        )
      }

      if (transferAmount === null || transferAmount <= 0) {
        return NextResponse.json(
          { success: false, message: 'El monto debe ser mayor a 0 cuando la transferencia está activa' },
          { status: 400 }
        )
      }
    }

    const updatePayload: Record<string, unknown> = {
      validate_inscriptions: validateInscriptions,
      enable_public_inscriptions: enablePublicInscriptions,
      show_few_slots_alert: showFewSlotsAlert,
      enable_payment_checkboxes: enablePaymentCheckboxes,
      enable_transfer_proof: enableTransferProof,
      transfer_alias: transferAlias,
      transfer_amount: transferAmount,
    }

    const { error: updateError } = await supabase
      .from('tournaments')
      .update(updatePayload)
      .eq('id', tournamentId)

    if (updateError) {
      return NextResponse.json(
        { success: false, message: updateError.message },
        { status: 500 }
      )
    }

    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/tournaments/${tournamentId}/settings`, 'layout')
    revalidatePath(`/tournaments/${tournamentId}/inscriptions`)
    revalidatePath('/tournaments')
    revalidatePath('/panel')
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      message: 'Configuración de inscripciones actualizada',
      data: updatePayload,
    })
  } catch (error) {
    console.error('[inscription-settings] Unexpected error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
