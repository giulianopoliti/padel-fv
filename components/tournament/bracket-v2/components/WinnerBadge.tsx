/**
 * WINNER BADGE - BADGE SIMPLE PARA GANADOR
 * 
 * Componente mínimo para mostrar un tick verde al ganador.
 * Diseñado para ser simple y directo.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-19
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

// ============================================================================
// TIPOS
// ============================================================================

export interface WinnerBadgeProps {
  /** Si esta pareja es la ganadora */
  isWinner: boolean
  /** Clase CSS adicional */
  className?: string
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function WinnerBadge({ isWinner, className }: WinnerBadgeProps) {
  if (!isWinner) return null

  return (
    <div className={cn(
      'flex items-center justify-center',
      'w-5 h-5 rounded-full bg-green-600',
      'text-white text-xs font-bold',
      className
    )}>
      <Check className="h-3 w-3" />
    </div>
  )
}
