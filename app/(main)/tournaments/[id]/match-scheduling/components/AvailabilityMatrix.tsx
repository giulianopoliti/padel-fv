'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Clock, Info, CalendarX } from 'lucide-react'
import { CoupleWithData, SchedulingData } from '../actions'
import { getDayOfWeek, formatTimeRange, formatDateWithDay } from '../utils/dateUtils'

interface AvailabilityMatrixProps {
  couples: CoupleWithData[]
  timeSlots: SchedulingData['timeSlots']
  availability: SchedulingData['availability']
  draggedCouple: CoupleWithData | null
  onCoupleSelect: (couple: CoupleWithData) => void
  onDragStart: (couple: CoupleWithData) => void
  onDragEnd: () => void
}

const AvailabilityMatrix: React.FC<AvailabilityMatrixProps> = ({
  couples,
  timeSlots,
  availability,
  draggedCouple,
  onCoupleSelect,
  onDragStart,
  onDragEnd
}) => {
  const handleDragStart = (couple: CoupleWithData, e: React.DragEvent) => {
    if (couple.free_date_blocked) {
      e.preventDefault()
      return
    }

    e.dataTransfer.setData('text/plain', couple.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(couple)
  }

  const handleDragEnd = () => {
    onDragEnd()
  }

  const handleCoupleClick = (couple: CoupleWithData) => {
    if (couple.free_date_blocked) {
      return
    }

    onCoupleSelect(couple)
  }

  // Check if couple is available for a specific time slot
  const isCoupleAvailable = (coupleId: string, timeSlotId: string): boolean => {
    const coupleAvailability = availability.find(a => 
      a.couple_id === coupleId && a.time_slot_id === timeSlotId
    )
    return coupleAvailability ? coupleAvailability.is_available : false
  }

  // Get availability notes for tooltip
  const getAvailabilityNotes = (coupleId: string, timeSlotId: string): string | null => {
    const coupleAvailability = availability.find(a => 
      a.couple_id === coupleId && a.time_slot_id === timeSlotId
    )
    return coupleAvailability?.notes || null
  }

  // Get couple display name
  const getCoupleDisplayName = (couple: CoupleWithData): string => {
    const player1Name = `${couple.player1.name} ${couple.player1.last_name || ''}`.trim()
    const player2Name = `${couple.player2.name} ${couple.player2.last_name || ''}`.trim()
    return `${player1Name} / ${player2Name}`
  }

  // Format time slot display using utility
  const formatTimeSlot = (timeSlot: SchedulingData['timeSlots'][0]): string => {
    return formatTimeRange(timeSlot.start_time, timeSlot.end_time)
  }

  // Show all couples - don't filter by has_played_in_this_date
  // We'll use visual indicators (colors) to show which couples have matches
  const displayedCouples = couples

  // Helper function to get row background color based on match status
  const getRowBackgroundColor = (couple: CoupleWithData): string => {
    if (couple.free_date_blocked) {
      return 'bg-red-50'
    }
    if (!couple.match_status) {
      return 'bg-white' // No match - normal white background
    }
    if (couple.match_status === 'DRAFT') {
      return 'bg-yellow-50' // Draft match - yellow background
    }
    if (couple.match_status === 'PENDING' || couple.match_status === 'FINISHED') {
      return 'bg-red-50' // Pending or Finished match - red background
    }
    return 'bg-white'
  }


  if (displayedCouples.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No hay parejas registradas para esta fecha
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          Matriz de Disponibilidad
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          Arrastra las parejas para seleccionarlas o haz clic para alternar selección
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span className="text-sm font-medium text-yellow-800">Partido en borrador</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-300 rounded-lg">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span className="text-sm font-medium text-red-800">Partido programado / finalizado</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-300 rounded-lg">
            <CalendarX className="w-3 h-3 text-red-600" />
            <span className="text-sm font-medium text-red-800">FECHA LIBRE</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3 text-slate-700 font-semibold min-w-[200px] sticky left-0 bg-white z-10">
                  Parejas
                </th>
                {timeSlots.map((timeSlot) => (
                  <th 
                    key={timeSlot.id} 
                    className="text-center p-3 text-slate-700 font-semibold min-w-[80px] text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{formatTimeSlot(timeSlot)}</span>
                      {timeSlot.date && (
                        <span className="text-xs text-blue-600 font-medium">
                          {formatDateWithDay(timeSlot.date)}
                        </span>
                      )}
                      {timeSlot.court_name && (
                        <span className="text-xs text-slate-500 mt-1">
                          {timeSlot.court_name}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedCouples.map((couple) => {
                const rowBgColor = getRowBackgroundColor(couple)

                return (
                  <tr
                    key={couple.id}
                    className={`
                      border-b border-gray-100 hover:bg-blue-50/50
                      transition-colors duration-200
                      ${couple.free_date_blocked ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'}
                      ${draggedCouple?.id === couple.id ? 'opacity-50 bg-blue-100' : rowBgColor}
                    `}
                    draggable={!couple.free_date_blocked}
                    onDragStart={(e) => {
                      e.stopPropagation()
                      handleDragStart(couple, e)
                    }}
                    onDragEnd={(e) => {
                      e.stopPropagation()
                      handleDragEnd()
                    }}
                    onClick={(e) => {
                      // Only handle click if not dragging
                      if (e.detail === 1) { // Single click only
                        handleCoupleClick(couple)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleCoupleClick(couple)
                      }
                    }}
                    aria-label={`Seleccionar pareja: ${getCoupleDisplayName(couple)}`}
                  >
                    <td className={`p-3 sticky left-0 z-10 border-r border-gray-100 ${rowBgColor}`}>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {getCoupleDisplayName(couple)}
                        </div>
                        {/* Zone info if available */}
                        {couple.zone_position && (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <Info className="w-3 h-3" />
                            <span>
                              {couple.zone_position.zone_name} - Pos {couple.zone_position.position}
                            </span>
                          </div>
                        )}
                        {couple.free_date_blocked && (
                          <div className="flex items-center gap-1 text-xs text-red-700">
                            <CalendarX className="w-3 h-3" />
                            <span>
                              FECHA LIBRE{couple.free_date_notes ? ` - ${couple.free_date_notes}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    {timeSlots.map((timeSlot) => (
                      <td key={timeSlot.id} className={`text-center p-3 ${rowBgColor}`}>
                        {isCoupleAvailable(couple.id, timeSlot.id) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-6 h-6 mx-auto bg-blue-600 rounded-full flex items-center justify-center shadow-sm border border-blue-700 cursor-help">
                                  <span className="text-white text-xs font-bold">✓</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-white border-gray-200 text-slate-900 shadow-lg max-w-xs"
                              >
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {formatTimeSlot(timeSlot)}
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    {timeSlot.date && formatDateWithDay(timeSlot.date)}
                                  </div>
                                  {getAvailabilityNotes(couple.id, timeSlot.id) && (
                                    <div className="text-xs text-blue-600 border-t border-gray-200 pt-1 mt-1">
                                      <strong>Nota:</strong> {getAvailabilityNotes(couple.id, timeSlot.id)}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {timeSlots.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-8 w-8 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">
              No hay horarios configurados para esta fecha
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AvailabilityMatrix
