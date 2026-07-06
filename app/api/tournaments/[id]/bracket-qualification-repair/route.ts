import { NextResponse } from 'next/server'
import {
  BracketQualificationAuditService,
  type BracketQualificationRepairMode,
} from '@/lib/services/bracket-qualification-audit.service'
import type { BracketKey } from '@/types/tournament-format-v2'

const REPAIR_MODES = new Set<BracketQualificationRepairMode>([
  'fill_single_missing',
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const body = await request.json().catch(() => ({}))
    const bracketKey = (body.bracketKey || 'MAIN') as BracketKey
    const mode = body.mode as BracketQualificationRepairMode

    if (!REPAIR_MODES.has(mode)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid repair mode',
      }, { status: 400 })
    }

    const result = await BracketQualificationAuditService.repairTournament(tournamentId, {
      bracketKey,
      mode,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 409 })
  } catch (error: any) {
    console.error('[bracket-qualification-repair] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to repair bracket qualification',
    }, { status: 500 })
  }
}
