'use client'

import React, { useCallback } from 'react'
import { mutate } from 'swr'
import StartMatchDialog from '@/components/tournament/start-match-dialog'
import LoadMatchResultDialog from '@/app/(main)/tournaments/[id]/match-scheduling/components/LoadMatchResultDialog'
import { BracketSingleSetResultDialog } from './BracketSingleSetResultDialog'
import { useMatchManagement } from '../hooks/useMatchManagement'
import type { BracketMatchV2, CoupleData } from '../types/bracket-types'

export type BracketMatchDialogAction =
  | { type: 'start'; match: BracketMatchV2 }
  | { type: 'result'; match: BracketMatchV2; isModify?: boolean }

interface BracketMatchActionDialogsProps {
  tournamentId: string
  tournamentType: 'AMERICAN' | 'LONG'
  action: BracketMatchDialogAction | null
  onClose: () => void
  onMatchUpdate?: (matchId: string, updatedData: unknown) => void
  onDataRefresh?: () => void
}

const formatCoupleLabel = (couple: CoupleData | null | undefined) => {
  if (!couple) return ''
  const p1 = `${couple.player1_details?.first_name || ''} ${couple.player1_details?.last_name || ''}`.trim()
  const p2 = `${couple.player2_details?.first_name || ''} ${couple.player2_details?.last_name || ''}`.trim()
  return `${p1} & ${p2}`
}

const invalidateBracketCaches = (tournamentId: string) => {
  mutate(`/api/tournaments/${tournamentId}/matches`)
  mutate(`tournament-sidebar-${tournamentId}`)
  mutate(`/api/tournaments/${tournamentId}/seeds`)
  mutate(
    (key) => typeof key === 'string' && key.includes(tournamentId),
    undefined,
    { revalidate: true }
  )
}

const adaptMatchForLongDialog = (match: BracketMatchV2) => {
  const couple1 = match.participants?.slot1?.couple
  const couple2 = match.participants?.slot2?.couple

  return {
    id: match.id,
    couple1_id: couple1?.id || '',
    couple2_id: couple2?.id || '',
    time_slot_id: null,
    status: match.status,
    scheduled_date: match.scheduling?.scheduled_time || null,
    scheduled_start_time: match.scheduling?.actual_start_time || null,
    scheduled_end_time: match.scheduling?.actual_end_time || null,
    court_assignment: match.scheduling?.court || null,
    couple1: couple1
      ? {
          player1: {
            first_name: couple1.player1_details?.first_name || '',
            last_name: couple1.player1_details?.last_name || '',
          },
          player2: {
            first_name: couple1.player2_details?.first_name || '',
            last_name: couple1.player2_details?.last_name || '',
          },
        }
      : null,
    couple2: couple2
      ? {
          player1: {
            first_name: couple2.player1_details?.first_name || '',
            last_name: couple2.player1_details?.last_name || '',
          },
          player2: {
            first_name: couple2.player2_details?.first_name || '',
            last_name: couple2.player2_details?.last_name || '',
          },
        }
      : null,
    club_id: null,
    club: null,
  }
}

export function BracketMatchActionDialogs({
  tournamentId,
  tournamentType,
  action,
  onClose,
  onMatchUpdate,
  onDataRefresh,
}: BracketMatchActionDialogsProps) {
  const isLongTournament = tournamentType === 'LONG'
  const [, matchActions] = useMatchManagement(tournamentId, onMatchUpdate)

  const handleSaved = useCallback(() => {
    invalidateBracketCaches(tournamentId)
    onDataRefresh?.()
    onClose()
  }, [tournamentId, onDataRefresh, onClose])

  const handleStartConfirm = useCallback(
    async (courtNumber: string) => {
      if (!action || action.type !== 'start') return
      const success = await matchActions.assignCourt(action.match.id, courtNumber, true)
      if (!success) {
        throw new Error('No se pudo iniciar el partido')
      }
      invalidateBracketCaches(tournamentId)
      onDataRefresh?.()
    },
    [action, matchActions, tournamentId, onDataRefresh]
  )

  const createLongResultBridge = useCallback(() => {
    return async (
      matchId: string,
      sets: Array<{ couple1_games: number; couple2_games: number }>,
      winnerId: string,
      resultCouple1: string,
      resultCouple2: string
    ) => {
      const matchSets = sets.map((set) => ({
        couple1_games: set.couple1_games,
        couple2_games: set.couple2_games,
      }))
      const result = matchActions.createBestOf3Result(matchSets, winnerId)
      const success = await matchActions.updateResult(matchId, result, true)

      if (success && onMatchUpdate) {
        onMatchUpdate(matchId, {
          result,
          status: 'FINISHED',
          result_couple1: resultCouple1,
          result_couple2: resultCouple2,
        })
      }

      return { success, error: success ? undefined : 'Error al guardar' }
    }
  }, [matchActions, onMatchUpdate])

  if (!action) return null

  const couple1 = action.match.participants?.slot1?.couple
  const couple2 = action.match.participants?.slot2?.couple

  if (action.type === 'start' && couple1 && couple2) {
    return (
      <StartMatchDialog
        isOpen
        onClose={onClose}
        onConfirm={handleStartConfirm}
        matchInfo={{
          couple1: formatCoupleLabel(couple1),
          couple2: formatCoupleLabel(couple2),
        }}
      />
    )
  }

  if (action.type === 'result' && couple1 && couple2) {
    if (isLongTournament) {
      return (
        <LoadMatchResultDialog
          match={adaptMatchForLongDialog(action.match)}
          open
          onOpenChange={(open) => !open && onClose()}
          onResultSaved={handleSaved}
          onUpdateMatchResult={createLongResultBridge()}
          isModifyMode={action.isModify}
          tournamentId={tournamentId}
        />
      )
    }

    return (
      <BracketSingleSetResultDialog
        open
        onOpenChange={(open) => !open && onClose()}
        match={action.match}
        couple1={couple1}
        couple2={couple2}
        tournamentId={tournamentId}
        isModifyMode={action.isModify}
        onResultSaved={handleSaved}
      />
    )
  }

  return null
}

export default BracketMatchActionDialogs
