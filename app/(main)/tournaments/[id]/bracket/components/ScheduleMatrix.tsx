'use client'

import React from 'react'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import MatchMatrixRow from './MatchMatrixRow'
import type { BracketMatchV2 } from '@/components/tournament/bracket-v2/types/bracket-types'

// Reutilizar tipos del sistema de match scheduling existente
interface TimeSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  court?: string
}

interface AvailabilityItem {
  couple_id: string
  time_slot_id: string
  is_available: boolean
  notes?: string | null
}

// Importar tipos para operaciones pendientes
import type { BracketSwapOperation } from '@/components/tournament/bracket-v2/types/bracket-drag-types'

interface ScheduleMatrixProps {
  matches: BracketMatchV2[]
  timeSlots: TimeSlot[]
  availability: AvailabilityItem[]
  onScheduleMatch: (matchId: string) => void
  onLoadResult: (matchId: string) => void
  loading?: boolean
  className?: string
  tournamentId?: string
  isOwner?: boolean
  dragEnabled?: boolean
  isEditMode?: boolean
  pendingOperations?: BracketSwapOperation[]
}

// Helper para formatear días con horario completo
const formatTimeSlotHeader = (dateString: string, startTime: string, endTime: string): string => {
  // Fix timezone issue: parse date components directly to avoid UTC interpretation
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const dayStr = String(day).padStart(2, '0')
  const monthStr = String(month).padStart(2, '0')

  return `${days[date.getDay()]} ${dayStr}/${monthStr} ${startTime.substring(0, 5)} - ${endTime.substring(0, 5)}`
}

export default function ScheduleMatrix({
  matches,
  timeSlots,
  availability,
  onScheduleMatch,
  onLoadResult,
  loading = false,
  className = '',
  tournamentId = '',
  isOwner = false,
  dragEnabled = true,
  isEditMode = false,
  pendingOperations = []
}: ScheduleMatrixProps) {

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Cargando matriz de programación...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-slate-500">
            <p className="text-lg mb-2">No hay matches para mostrar</p>
            <p className="text-sm">Selecciona una ronda diferente o verifica que el bracket esté generado</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        {/* Mobile view - Stack cards */}
        <div className="block lg:hidden">
          <div className="p-4 space-y-4">
            {matches.map((match, index) => (
              <Card key={match.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Match header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-700">
                            {match.position || index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Match {match.position || index + 1}</div>
                          <div className="text-xs text-slate-500">{match.round}</div>
                        </div>
                      </div>
                    </div>

                    {/* Couples */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {match.participants?.slot1?.couple?.name || 'Pareja TBD'}
                      </div>
                      <div className="text-sm">
                        {match.participants?.slot2?.couple?.name || 'Pareja TBD'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onScheduleMatch(match.id)}
                        className="flex-1"
                      >
                        📅 Programar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onLoadResult(match.id)}
                        className="flex-1"
                      >
                        📊 Resultado
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Desktop view - Matrix table */}
        <div className="hidden lg:block">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>

              {/* Header con time slots */}
              <TableHeader>
                <TableRow className="bg-slate-50">

                  {/* Columna de matches */}
                  <TableHead className="w-64 font-semibold text-slate-900 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                    <div className="flex items-center gap-2">
                      <span>Partidos</span>
                      <div className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                        {matches.length}
                      </div>
                    </div>
                  </TableHead>

                  {/* Columnas de time slots - Reducido el ancho */}
                  {timeSlots.map(slot => (
                    <TableHead key={slot.id} className="text-center min-w-28 border-r border-slate-200">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700">
                          {formatTimeSlotHeader(slot.date, slot.start_time, slot.end_time)}
                        </div>
                        {slot.court && (
                          <div className="text-xs text-slate-500">
                            {slot.court}
                          </div>
                        )}
                      </div>
                    </TableHead>
                  ))}

                  {/* Columna de acciones */}
                  <TableHead className="w-32 text-center font-semibold text-slate-900">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>

              {/* Body con matches */}
              <TableBody>
                {matches.map((match, index) => (
                  <MatchMatrixRow
                    key={match.id}
                    match={match}
                    matchIndex={index}
                    timeSlots={timeSlots}
                    availability={availability}
                    onScheduleMatch={onScheduleMatch}
                    onLoadResult={onLoadResult}
                    tournamentId={tournamentId}
                    isOwner={isOwner}
                    dragEnabled={dragEnabled}
                    isEditMode={isEditMode}
                    pendingOperations={pendingOperations}
                  />
                ))}
              </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Footer informativo */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div>
                <span>No disponible</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></div>
                <span>Sin datos</span>
              </div>
            </div>
            <div className="text-slate-500">
              📅 = Programar horario • 📊 = Cargar resultado
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}