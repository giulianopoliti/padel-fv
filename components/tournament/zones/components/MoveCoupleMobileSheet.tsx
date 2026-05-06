'use client'

/**
 * MoveCoupleMobileSheet Component
 *
 * Bottom sheet for mobile devices that displays available zones
 * when user taps a couple to move it.
 *
 * UX Flow:
 * 1. User taps a couple
 * 2. This sheet slides up from bottom
 * 3. Shows list of zones with availability status
 * 4. User taps destination zone
 * 5. Couple moves + sheet closes
 */

import React, { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, ChevronRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeleteCoupleDialog } from './DeleteCoupleDialog'

interface ZoneOption {
  id: string
  name: string
  currentSize: number
  capacity: number
  canReceive: boolean
}

interface MoveCoupleMobileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCouple: {
    id: string
    name: string
    sourceZoneId: string | null
  } | null
  zones: ZoneOption[]
  onMoveToZone: (zoneId: string) => void
  onMoveToPool: () => void
  onDelete: () => void
  showPoolOption: boolean
  showDeleteOption: boolean
}

export function MoveCoupleMobileSheet({
  open,
  onOpenChange,
  selectedCouple,
  zones,
  onMoveToZone,
  onMoveToPool,
  onDelete,
  showPoolOption,
  showDeleteOption
}: MoveCoupleMobileSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Handler para mover a zona
  const handleSelectZone = (zoneId: string) => {
    onMoveToZone(zoneId)
    onOpenChange(false)
  }

  // Handler para mover a pool
  const handleSelectPool = () => {
    onMoveToPool()
    onOpenChange(false)
  }

  // Handler para abrir dialog de confirmación
  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  // Handler para confirmar eliminación
  const handleConfirmDelete = () => {
    onDelete()
    onOpenChange(false)
  }

  if (!selectedCouple) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Mover Pareja</SheetTitle>
          <SheetDescription className="text-base font-medium text-slate-900">
            {selectedCouple.name}
          </SheetDescription>
          <p className="text-sm text-slate-500 mt-2">
            Seleccioná la zona de destino:
          </p>
        </SheetHeader>

        {/* Lista de Zonas - Scrolleable */}
        <div className="flex-1 overflow-y-auto mt-6 space-y-2 px-1">
          {zones.map((zone) => {
            // No mostrar la zona de origen
            const isSourceZone = selectedCouple.sourceZoneId === zone.id
            if (isSourceZone) return null

            return (
              <Button
                key={zone.id}
                onClick={() => handleSelectZone(zone.id)}
                disabled={!zone.canReceive}
                variant={zone.canReceive ? 'outline' : 'ghost'}
                className={cn(
                  'w-full justify-between h-auto py-4 px-4',
                  zone.canReceive
                    ? 'hover:bg-green-50 hover:border-green-400 active:bg-green-100'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                      zone.canReceive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    <MapPin className="h-6 w-6" />
                  </div>

                  {/* Info */}
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">
                      {zone.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {zone.currentSize}/{zone.capacity} parejas
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                {zone.canReceive ? (
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                ) : (
                  <Badge variant="destructive" className="flex-shrink-0">
                    Llena
                  </Badge>
                )}
              </Button>
            )
          })}

          {/* Separator visual */}
          {(showPoolOption || showDeleteOption) && (
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-500 font-medium">
                  O realizar otra acción
                </span>
              </div>
            </div>
          )}

          {/* Pool Option - Con color azul */}
          {showPoolOption && (
            <Button
              onClick={handleSelectPool}
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4",
                "border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 active:scale-[0.98]"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>

                {/* Info */}
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-base text-blue-900">
                    Devolver a Pool Sin Asignar
                  </div>
                  <div className="text-sm text-blue-700">
                    Quitar de zona actual
                  </div>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 flex-shrink-0 text-blue-400" />
            </Button>
          )}

          {/* Delete Option - Con color rojo */}
          {showDeleteOption && (
            <Button
              onClick={handleDeleteClick}
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4",
                "border-2 border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100 active:scale-[0.98]"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>

                {/* Info */}
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-base text-red-900">
                    Eliminar del Torneo
                  </div>
                  <div className="text-sm text-red-700">
                    Se borrará de inscripciones y zonas
                  </div>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 flex-shrink-0 text-red-400" />
            </Button>
          )}
        </div>

        {/* Footer: Cancelar con color gris */}
        <SheetFooter className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full bg-slate-50 hover:bg-slate-100 border-slate-300"
          >
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <DeleteCoupleDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        coupleName={selectedCouple.name}
        onConfirm={handleConfirmDelete}
      />
    </Sheet>
  )
}
