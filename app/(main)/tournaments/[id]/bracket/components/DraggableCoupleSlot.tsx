'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useBracketDragDrop } from '@/components/tournament/bracket-v2/context/bracket-drag-context'
import { useBracketDragOperations } from '@/components/tournament/bracket-v2/hooks/useBracketDragOperations'
import type { BracketMatchV2, CoupleData } from '@/components/tournament/bracket-v2/types/bracket-types'

interface DraggableCoupleSlotProps {
  couple: CoupleData | undefined
  match: BracketMatchV2
  slotPosition: 'slot1' | 'slot2'
  dragEnabled?: boolean
  className?: string
  children: React.ReactNode
  tournamentId?: string
  isOwner?: boolean
}

export default function DraggableCoupleSlot({
  couple,
  match,
  slotPosition,
  dragEnabled = false,
  className = '',
  children,
  tournamentId = '',
  isOwner = false
}: DraggableCoupleSlotProps) {

  const { state: dragState } = useBracketDragDrop()
  const {
    isDragging,
    draggedItem,
    dragOverTarget,
    startDrag,
    endDrag,
    setDragOver,
    handleDrop: handleDropOperation,
    canDragCouple,
    canDropToSlot,
    createDropTarget
  } = useBracketDragOperations({
    tournamentId,
    isOwner
  })

  // Estados del slot
  const isThisSlotDragged = draggedItem?.sourceMatchId === match.id &&
                           draggedItem?.sourceSlot === slotPosition
  const isValidDropTarget = dragOverTarget?.matchId === match.id &&
                           dragOverTarget?.slot === slotPosition &&
                           dragOverTarget?.isValid
  const isHovering = dragOverTarget?.matchId === match.id &&
                    dragOverTarget?.slot === slotPosition

  // Verificar si se puede arrastrar este slot
  const dragValidation = couple && dragEnabled ? canDragCouple(couple, match, slotPosition) : { canDrag: false }

  // Verificar si se puede soltar en este slot
  const dropValidation = dragEnabled ? canDropToSlot(match, slotPosition) : { canDrop: false }

  // ============================================================================
  // HANDLERS HTML5 DRAG & DROP
  // ============================================================================

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()

    if (!couple || !dragValidation.canDrag) {
      e.preventDefault()
      return
    }

    // Configurar el drag
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({
      coupleId: couple.id,
      matchId: match.id,
      slot: slotPosition
    }))

    // Iniciar drag en el hook
    startDrag(couple, match, slotPosition)
  }

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    endDrag()
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (isDragging && dropValidation.canDrop) {
      e.dataTransfer.dropEffect = 'move'

      // Crear y setear drop target
      const dropTarget = createDropTarget(match, slotPosition)
      setDragOver(dropTarget)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()

    // Solo limpiar si realmente salimos del elemento
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (!dropValidation.canDrop) {
      return
    }

    try {
      // El drop es manejado por el hook
      handleDropOperation(match, slotPosition)
    } catch (error) {
      console.error('Drop error:', error)
    }
  }

  // ============================================================================
  // ESTILOS DINÁMICOS
  // ============================================================================

  const slotClasses = cn(
    'relative transition-all duration-200',
    className,
    {
      // Estados de drag
      'opacity-50 scale-95': isThisSlotDragged,
      'bg-blue-50 border-2 border-blue-400 border-dashed rounded': isThisSlotDragged,

      // Estados de drop
      'bg-green-50 border-2 border-green-400 border-dashed rounded': isValidDropTarget && !isThisSlotDragged,
      'bg-red-50 border-2 border-red-400 border-dashed rounded': isHovering && !dropValidation.canDrop,

      // Estados de hover
      'ring-2 ring-green-300 ring-opacity-50 rounded': isHovering && dropValidation.canDrop && !isThisSlotDragged,

      // Cursor states
      'cursor-grab': dragValidation.canDrag && !isDragging,
      'cursor-grabbing': dragValidation.canDrag && isThisSlotDragged,
      'cursor-not-allowed': !dragValidation.canDrag && couple,
      'cursor-pointer': !dragValidation.canDrag && !couple
    }
  )

  if (!dragEnabled) {
    return (
      <div className={className}>
        {children}
      </div>
    )
  }

  return (
    <div
      className={slotClasses}
      draggable={dragValidation.canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={
        couple
          ? (dragValidation.canDrag
             ? `Arrastra para mover: ${couple.player1_details?.first_name} & ${couple.player2_details?.first_name}`
             : dragValidation.reason)
          : dropValidation.canDrop
            ? 'Slot disponible para drop'
            : dropValidation.reason
      }
    >
      {children}

      {/* Indicadores visuales */}
      {isThisSlotDragged && (
        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10">
          Arrastrando...
        </div>
      )}

      {isValidDropTarget && (
        <div className="absolute top-0 left-0 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10">
          ✓ Soltar aquí
        </div>
      )}

      {isHovering && !dropValidation.canDrop && (
        <div className="absolute top-0 left-0 bg-red-600 text-white text-xs px-1 py-0.5 rounded z-10">
          ✗ No válido
        </div>
      )}
    </div>
  )
}