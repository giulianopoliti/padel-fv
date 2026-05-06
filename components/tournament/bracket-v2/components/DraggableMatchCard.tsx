/**
 * DRAGGABLE MATCH CARD - MATCH CARD CON DRAG & DROP HTML5
 * 
 * Wrapper del MatchCard que añade funcionalidades de drag & drop nativo.
 * Cada slot de pareja es draggable individualmente.
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-18
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { MatchCard, type MatchCardProps } from './MatchCard'
import { useBracketDragOperations } from '../hooks/useBracketDragOperations'
import type {
  BracketMatchV2,
  CoupleData,
  ParticipantSlot
} from '../types/bracket-types'
import type { BracketDropTarget } from '../types/bracket-drag-types'

// ============================================================================
// TIPOS
// ============================================================================

export interface DraggableMatchCardProps extends Omit<MatchCardProps, 'onParticipantClick'> {
  /** ID del torneo */
  tournamentId: string
  /** Si el usuario es owner */
  isOwner?: boolean
  /** Configuración de drag & drop */
  dragConfig?: {
    enabled: boolean
    sameRoundOnly?: boolean
  }
  /** Handler personalizado para clicks en participantes */
  onParticipantClick?: (slot: ParticipantSlot, slotPosition: 'slot1' | 'slot2', match: BracketMatchV2) => void
}

/**
 * Props para el slot draggable individual
 */
interface DraggableSlotProps {
  match: BracketMatchV2
  slot: ParticipantSlot
  slotPosition: 'slot1' | 'slot2'
  isOwner: boolean
  onParticipantClick?: (slot: ParticipantSlot, slotPosition: 'slot1' | 'slot2') => void
}

// ============================================================================
// COMPONENTE DE SLOT DRAGGABLE
// ============================================================================

function DraggableSlot({
  match,
  slot,
  slotPosition,
  isOwner,
  onParticipantClick
}: DraggableSlotProps) {
  
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
    tournamentId: match.tournament_id || '',
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
  const couple = slot.type === 'couple' ? slot.couple : null
  const dragValidation = couple ? canDragCouple(couple, match, slotPosition) : { canDrag: false }
  
  // Verificar si se puede soltar en este slot
  const dropValidation = canDropToSlot(match, slotPosition)
  
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
    
    // Custom drag image
    const dragImage = document.createElement('div')
    dragImage.className = 'bg-blue-500 text-white px-3 py-2 rounded shadow-lg text-sm font-medium'
    dragImage.innerHTML = `
      <div>${couple.player1_details?.first_name || ''} &amp; ${couple.player2_details?.first_name || ''}</div>
      <div class="text-xs opacity-75">Posición ${match.round} - ${slotPosition.toUpperCase()}</div>
    `
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    // Limpiar después
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 0)
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
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onParticipantClick) {
      onParticipantClick(slot, slotPosition)
    }
  }
  
  // ============================================================================
  // ESTILOS DINÁMICOS
  // ============================================================================
  
  const slotClasses = cn(
    'absolute inset-0 transition-all duration-200',
    {
      // Estados de drag
      'opacity-50 scale-95': isThisSlotDragged,
      'bg-blue-50 border-2 border-blue-400 border-dashed': isThisSlotDragged,
      
      // Estados de drop
      'bg-green-50 border-2 border-green-400 border-dashed': isValidDropTarget && !isThisSlotDragged,
      'bg-red-50 border-2 border-red-400 border-dashed': isHovering && !dropValidation.canDrop,
      
      // Estados de hover
      'ring-2 ring-green-300 ring-opacity-50': isHovering && dropValidation.canDrop && !isThisSlotDragged,
      
      // Cursor states
      'cursor-grab': dragValidation.canDrag && !isDragging,
      'cursor-grabbing': dragValidation.canDrag && isThisSlotDragged,
      'cursor-not-allowed': !dragValidation.canDrag && couple,
      'cursor-pointer': !dragValidation.canDrag && !couple
    }
  )
  
  return (
    <div
      className={slotClasses}
      draggable={dragValidation.canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
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
      {/* Indicadores visuales */}
      {isThisSlotDragged && (
        <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10">
          Arrastrando...
        </div>
      )}
      
      {isValidDropTarget && (
        <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10">
          ✓ Soltar aquí
        </div>
      )}
      
      {isHovering && !dropValidation.canDrop && (
        <div className="absolute top-1 left-1 bg-red-600 text-white text-xs px-1 py-0.5 rounded z-10">
          ✗ No válido
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * MatchCard con funcionalidades de drag & drop
 */
export function DraggableMatchCard({
  tournamentId,
  isOwner = false,
  dragConfig = { enabled: true, sameRoundOnly: true },
  onParticipantClick,
  className,
  ...matchCardProps
}: DraggableMatchCardProps) {
  
  const { match } = matchCardProps
  
  // Si drag está deshabilitado, usar MatchCard normal
  if (!dragConfig.enabled || !isOwner) {
    return (
      <MatchCard
        {...matchCardProps}
        onParticipantClick={onParticipantClick}
        className={className}
      />
    )
  }
  
  return (
    <div className={cn('relative group', className)}>
      {/* MatchCard base */}
      <MatchCard
        {...matchCardProps}
        onParticipantClick={undefined} // Deshabilitamos el click del MatchCard base
        className="relative"
      />
      
      {/* Overlay draggable para slot1 (mitad superior) */}
      <div className="absolute top-0 left-0 w-full h-1/2 pointer-events-auto">
        <DraggableSlot
          match={match}
          slot={match.participants.slot1}
          slotPosition="slot1"
          isOwner={isOwner}
          onParticipantClick={onParticipantClick}
        />
      </div>
      
      {/* Overlay draggable para slot2 (mitad inferior) */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-auto">
        <DraggableSlot
          match={match}
          slot={match.participants.slot2}
          slotPosition="slot2"
          isOwner={isOwner}
          onParticipantClick={onParticipantClick}
        />
      </div>
      
      {/* Indicador de drag & drop habilitado */}
      {isOwner && match.status === 'PENDING' && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-700 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
            <svg width="8" height="8" viewBox="0 0 12 12" className="text-slate-300">
              <circle cx="3" cy="3" r="1" fill="currentColor" />
              <circle cx="9" cy="3" r="1" fill="currentColor" />
              <circle cx="3" cy="9" r="1" fill="currentColor" />
              <circle cx="9" cy="9" r="1" fill="currentColor" />
            </svg>
            Drag
          </div>
        </div>
      )}
    </div>
  )
}

export default DraggableMatchCard