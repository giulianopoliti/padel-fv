import { NextResponse } from 'next/server'
import { BracketQualificationAuditService } from '@/lib/services/bracket-qualification-audit.service'
import type { BracketKey } from '@/types/tournament-format-v2'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const bracketKey = (searchParams.get('bracketKey') || 'MAIN') as BracketKey

    const audit = await BracketQualificationAuditService.auditTournament(tournamentId, { bracketKey })

    return NextResponse.json({ success: true, audit })
  } catch (error: any) {
    console.error('[bracket-qualification-audit] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to audit bracket qualification',
    }, { status: 500 })
  }
}
