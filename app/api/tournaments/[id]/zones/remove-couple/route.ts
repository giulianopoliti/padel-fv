import { NextResponse } from 'next/server'
import { updateZonePositions } from '@/app/api/tournaments/[id]/actions'
import { ZoneRulesSyncService } from '@/lib/services/zone-rules-sync.service'
import { applyAuthorizedZoneMembershipChanges } from '@/lib/services/zone-position/zone-membership-transaction.service'
import { createApiResponse } from '@/utils/serialization'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { coupleId, zoneId } = await request.json()
    const supabase = await createClient()

    try {
      await applyAuthorizedZoneMembershipChanges(tournamentId, [{
        couple_id: coupleId,
        from_zone_id: zoneId,
        to_zone_id: null,
        to_position: null,
      }])
    } catch (membershipError: any) {
      return NextResponse.json(
        createApiResponse({ success: false, message: membershipError.message }),
        { status: 400 }
      )
    }

    const syncResult = await ZoneRulesSyncService.syncZoneRulesForZone(supabase, zoneId)
    if (!syncResult.success) {
      return NextResponse.json(
        createApiResponse({ success: false, message: syncResult.error || 'Error sincronizando reglas de zona' }),
        { status: 400 }
      )
    }

    const { count: remainingCount, error: remainingError } = await supabase
      .from('zone_positions')
      .select('id', { head: true, count: 'exact' })
      .eq('tournament_id', tournamentId)
      .eq('zone_id', zoneId)

    if (remainingError) throw new Error(remainingError.message)

    if ((remainingCount || 0) > 0) {
      try {
        await updateZonePositions(tournamentId, zoneId)
      } catch (recalcError: any) {
        return NextResponse.json(
          createApiResponse({
            success: false,
            message: `La pareja fue removida, pero no se pudo recalcular la zona: ${recalcError.message}`,
          }),
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      createApiResponse({ success: true, message: 'Pareja removida de la zona' })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse({ success: false, message: error.message }),
      { status: 500 }
    )
  }
}
