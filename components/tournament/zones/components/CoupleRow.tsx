"use client"

/**
 * CoupleRow Component
 * 
 * Displays a draggable couple row with rich animations and proper accessibility.
 */

import React from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { Clock } from 'lucide-react'
import type { SerializableCouple, Match, MatchResult } from '../types/zone-types'
import type { DragItem } from '../types/drag-types'
import { useDragDropOperations } from '../hooks/use-drag-drop'
import { useCoupleGamesStats, formatGamesDifference } from '../hooks/use-couple-games-stats'
import { toast } from '../utils/toast-alternative'

interface CoupleRowProps {
  couple: SerializableCouple
  zoneId?: string // If in a zone
  isEditMode: boolean
  isInZone: boolean
  maxColumns?: number // For zone matrix display
  zoneCouples?: SerializableCouple[] // All couples in the zone for match results
  matches?: Match[] // Match data for results display
  couplePosition?: number // Real calculated position from zone positions
  coupleIndex?: number // Index in zone for fallback position
  onDragStart?: (item: DragItem) => void
  onDragEnd?: () => void
  onCellClick?: (couple1: SerializableCouple, couple2: SerializableCouple, match: Match | null) => void
  isOwner?: boolean
  isMobile?: boolean
  selectedCoupleForMove?: { coupleId: string; coupleName: string; sourceZoneId: string | null } | null
  onCoupleSelect?: (selection: { coupleId: string; coupleName: string; sourceZoneId: string | null } | null) => void
}

export function CoupleRow({
  couple,
  zoneId,
  isEditMode,
  isInZone,
  maxColumns = 4,
  zoneCouples = [],
  matches = [],
  couplePosition,
  coupleIndex = 0,
  onDragStart,
  onDragEnd,
  onCellClick,
  isOwner = false,
  isMobile = false,
  selectedCoupleForMove = null,
  onCoupleSelect
}: CoupleRowProps) {
  const {
    isDragging,
    draggedItem,
    createZoneCoupleItem,
    createAvailableCoupleItem,
    getAnimationClasses,
    canDragCouple,
    getCoupleRestrictionReason
  } = useDragDropOperations()
  
  // Calculate games statistics for this couple
  const { getStatsForCouple } = useCoupleGamesStats(matches, zoneId)
  const gamesStats = getStatsForCouple(couple.id)
  
  // Calculate real position (use calculated position or fallback to index + 1)
  const displayPosition = couplePosition || (coupleIndex + 1)
  
  // Check if this couple is being dragged
  const isBeingDragged = isDragging && draggedItem?.coupleId === couple.id
  
  // Check if couple can be dragged (not restricted)
  const canDrag = canDragCouple(couple.id)
  const restrictionReason = getCoupleRestrictionReason(couple.id)
  
  // Get animation classes for this couple
  const animationClasses = getAnimationClasses(couple.id)
  
  // Helper function to get match result between two couples (with match object)
  const getMatchResult = (couple1Id: string, couple2Id: string): (MatchResult & { match?: Match }) | null => {
    const match = matches.find(m =>
      // ✅ Only search for ZONE matches (not ELIMINATION bracket matches)
      m.zone_id === zoneId &&           // Filter by specific zone
      m.round === 'ZONE' &&              // Only zone phase matches (not bracket)
      (
        (m.couple1_id === couple1Id && m.couple2_id === couple2Id) ||
        (m.couple1_id === couple2Id && m.couple2_id === couple1Id)
      )
    )

    if (!match) return null

    if (match.status !== 'FINISHED' || !match.result_couple1 || !match.result_couple2) {
      return {
        match, // ✅ Include match object
        status: match.status,
        result: null,
        isPending: true
      }
    }

    // Determine the result from couple1's perspective
    let couple1Result, couple2Result
    if (match.couple1_id === couple1Id) {
      couple1Result = match.result_couple1
      couple2Result = match.result_couple2
    } else {
      couple1Result = match.result_couple2
      couple2Result = match.result_couple1
    }

    return {
      match, // ✅ Include match object
      status: match.status,
      result: `${couple1Result}-${couple2Result}`,
      isPending: false,
      isWin: couple1Result > couple2Result
    }
  }
  
  // Handle drag start
  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditMode || !canDrag) {
      e.preventDefault()
      return
    }
    
    e.dataTransfer.effectAllowed = 'move'
    
    // Create appropriate drag item with properly formatted names
    const coupleName = `${couple.player1Name} / ${couple.player2Name}`
    const dragItem = isInZone && zoneId 
      ? createZoneCoupleItem(couple.id, coupleName, zoneId)
      : createAvailableCoupleItem(couple.id, coupleName)
    
    if (onDragStart) {
      onDragStart(dragItem)
    }
  }
  
  // Handle drag end
  const handleDragEnd = (e: React.DragEvent) => {
    if (onDragEnd) {
      onDragEnd()
    }
  }

  // Handle click/tap to open sidebar (desktop) or bottom sheet (mobile) for moving
  const handleCoupleTap = () => {
    // Only in edit mode + can drag (works on both mobile and desktop)
    if (!isEditMode || !canDrag || !onCoupleSelect) return

    // Open sidebar (desktop) or bottom sheet (mobile) with couple data
    onCoupleSelect({
      coupleId: couple.id,
      coupleName: `${couple.player1Name} / ${couple.player2Name}`,
      sourceZoneId: isInZone && zoneId ? zoneId : null
    })
  }

  // Base classes for the row
  const baseClasses = [
    'border-b transition-all duration-200',
    isEditMode && canDrag ? 'cursor-move hover:bg-slate-50' : '',
    isEditMode && !canDrag ? 'cursor-not-allowed opacity-60 bg-gray-100' : '',
    isBeingDragged ? 'opacity-50 scale-95' : '',
    isMobile && isEditMode ? 'select-none' : '',  // Prevent text selection in mobile
    animationClasses
  ].filter(Boolean).join(' ')
  
  return (
    <TableRow
      className={baseClasses}
      draggable={isEditMode && canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={!canDrag && restrictionReason ? restrictionReason : undefined}
    >
      {/* Position Number */}
      {isInZone && (
        <TableCell className="text-center w-6 font-bold text-lg">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            displayPosition === 1 ? 'bg-yellow-200 text-yellow-800' :
            displayPosition === 2 ? 'bg-gray-200 text-gray-800' :
            displayPosition === 3 ? 'bg-orange-200 text-orange-800' :
            couplePosition ? 'bg-blue-100 text-blue-800' :
            'bg-slate-100 text-slate-600'
          }`}>
            {displayPosition}
          </div>
        </TableCell>
      )}

      {/* Couple Names - Clickeable in edit mode */}
      <TableCell
        className={`font-medium ${isEditMode && canDrag ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''}`}
        onClick={isEditMode && canDrag ? handleCoupleTap : undefined}
        role={isEditMode && canDrag ? 'button' : undefined}
        tabIndex={isEditMode && canDrag ? 0 : undefined}
        aria-label={isEditMode && canDrag ? `Mover pareja ${couple.player1Name} y ${couple.player2Name}` : undefined}
        onKeyDown={(e) => {
          if (isEditMode && canDrag && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            handleCoupleTap()
          }
        }}
      >
        <div className="flex items-center gap-2">
          {isEditMode && canDrag && (
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                 aria-hidden="true" />
          )}
          {isEditMode && !canDrag && (
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                 aria-hidden="true"
                 title={restrictionReason || ""}>
              <span className="text-white text-xs font-bold">✕</span>
            </div>
          )}
          <div>
            <div className={`font-medium text-sm ${!canDrag ? 'text-gray-500' : ''}`}>
              {couple.player1Name} / {couple.player2Name}
            </div>
            {!canDrag && restrictionReason && (
              <div className="text-xs text-red-600">
                {restrictionReason}
              </div>
            )}
            {couple.metadata?.registrationDate && (
              <div className="text-xs text-slate-500">
                Registrado: {new Date(couple.metadata.registrationDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      
      {/* Zone Matrix Columns - Only show if in zone */}
      {isInZone && (
        <>
          {zoneCouples.map((opponentCouple, colIndex) => {
            const matchResult = getMatchResult(couple.id, opponentCouple.id)
            const isClickable = couple.id !== opponentCouple.id && isOwner && onCellClick

            return (
              <TableCell
                key={opponentCouple.id}
                className={`text-center w-12 p-1 ${
                  isClickable
                    ? 'cursor-pointer hover:bg-blue-50 hover:ring-2 hover:ring-blue-300 hover:ring-inset transition-all rounded'
                    : ''
                }`}
                onClick={() => {
                  if (isClickable) {
                    onCellClick(couple, opponentCouple, matchResult?.match || null)
                  }
                }}
                title={isClickable ? 'Click para gestionar partido' : ''}
              >
                {couple.id === opponentCouple.id ? (
                  // Same couple - blocked cell with diagonal pattern
                  <div className="bg-slate-300 text-slate-500 text-xs font-bold py-1 px-2 rounded">
                    ■■■
                  </div>
                ) : (
                  // Different couple - show match result
                  (() => {
                    if (!matchResult) {
                      // No match scheduled
                      return (
                        <div className="text-slate-400 text-xs py-1 px-2">
                          —
                        </div>
                      )
                    } else if (matchResult.isPending) {
                      // Match scheduled but not finished
                      return (
                        <div className="flex flex-col items-center justify-center gap-0.5 py-1" title="Partido pendiente">
                          <Clock className="h-3 w-3 text-blue-500" />
                          {matchResult.match?.court && (
                            <span className="text-[10px] font-bold text-blue-600">
                              C{matchResult.match.court}
                            </span>
                          )}
                        </div>
                      )
                    } else {
                      // Match finished - show result
                      return (
                        <div className={`text-xs font-medium py-1 px-2 rounded ${
                          matchResult.isWin
                            ? 'text-green-700 bg-green-50'
                            : 'text-red-700 bg-red-50'
                        }`}>
                        {matchResult.result}
                      </div>
                    )
                  }
                })()
              )}
            </TableCell>
            )
          })}
          
          {/* Statistics Columns - Games Won/Lost */}
          <TableCell className="text-center w-12 text-xs">
            <div className="text-green-600 font-medium">
              {gamesStats.gamesWon}
            </div>
          </TableCell>
          <TableCell className="text-center w-12 text-xs">
            <div className="text-red-600">
              {gamesStats.gamesLost}
            </div>
          </TableCell>
          
          {/* Games Difference Column */}
          <TableCell className="text-center font-semibold w-16">
            <div className={`rounded px-2 py-1 text-sm ${
              gamesStats.gamesDifference > 0 ? 'bg-green-100 text-green-800' :
              gamesStats.gamesDifference < 0 ? 'bg-red-100 text-red-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {formatGamesDifference(gamesStats.gamesDifference)}
            </div>
          </TableCell>
        </>
      )}
    </TableRow>
  )
}