'use client'

import { useState, useEffect, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Clock, Users, Save, Check, AlertCircle, Info, CalendarDays } from 'lucide-react'
import { UserAccess, PlayerScheduleData, TimeSlot } from '../types'
import { getPlayerScheduleData, updateCoupleAvailability } from '../actions'
import { PlayerAvailabilitySkeleton } from './LoadingStates'
import { InlineError } from './ErrorStates'
import { toast } from 'sonner'
import { formatDateWithWeekday } from '../utils'

interface PlayerViewProps {
  tournamentId: string
  fechaId: string
  userAccess: UserAccess
}

export default function PlayerView({ 
  tournamentId, 
  fechaId, 
  userAccess 
}: PlayerViewProps) {
  const [scheduleData, setScheduleData] = useState<PlayerScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const loadPlayerData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const result = await getPlayerScheduleData(tournamentId, fechaId)
        
        if (result.success) {
          setScheduleData(result.data)
        } else {
          setError(result.error)
        }
      } catch (err) {
        setError('Error inesperado al cargar los datos')
        console.error('Error loading player schedule data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPlayerData()
  }, [tournamentId, fechaId])

  const handleAvailabilityChange = async (
    timeSlotId: string, 
    isAvailable: boolean, 
    notes?: string
  ) => {
    if (!scheduleData || !userAccess.coupleId) return

    startTransition(async () => {
      try {
        const result = await updateCoupleAvailability({
          tournament_id: tournamentId,
          fecha_id: fechaId,
          time_slot_id: timeSlotId,
          couple_id: userAccess.coupleId!,
          is_available: isAvailable,
          notes: notes || null
        })

        if (result.success) {
          // Update local state
          setScheduleData(prev => {
            if (!prev) return prev
            
            const updatedTimeSlots = prev.timeSlots.map(slot => {
              if (slot.id === timeSlotId) {
                return {
                  ...slot,
                  my_availability: {
                    couple_id: userAccess.coupleId!,
                    is_available: isAvailable,
                    notes: notes || null
                  }
                }
              }
              return slot
            })
            
            return { ...prev, timeSlots: updatedTimeSlots }
          })
          
          toast.success('Disponibilidad actualizada correctamente')
        } else {
          toast.error(result.error)
        }
      } catch (err) {
        toast.error('Error inesperado al actualizar disponibilidad')
        console.error('Error updating availability:', err)
      }
    })
  }

  const handleRetry = () => {
    setScheduleData(null)
    setError(null)
    setLoading(true)
  }

  if (loading) {
    return <PlayerAvailabilitySkeleton />
  }

  if (error) {
    return <InlineError message={error} onRetry={handleRetry} />
  }

  if (!scheduleData) {
    return <InlineError message="No se pudieron cargar los datos de disponibilidad" onRetry={handleRetry} />
  }

  if (!userAccess.coupleId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sin pareja asignada</h3>
          <p className="text-gray-600">
            No se pudo encontrar tu pareja para este torneo. Contacta al organizador.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { timeSlots, coupleInfo } = scheduleData

  // Defensive check
  if (!coupleInfo) {
    return <InlineError message="Error: Información de pareja no disponible" />
  }

  return (
    <div className="space-y-6">
      {/* Header with couple info */}
      <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Disponibilidad Horaria</h2>
                <Separator className="my-2" />
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <p className="text-sm text-slate-600 mb-1 font-medium">Tu Pareja:</p>
                <p className="text-lg font-bold text-green-800">
                  {coupleInfo.player1_name} / {coupleInfo.player2_name}
                </p>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Marca los horarios donde ambos jugadores están disponibles
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Accordion type="single" collapsible defaultValue="instructions" className="w-full">
        <AccordionItem value="instructions" className="border rounded-lg px-4 bg-blue-50/50">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Info className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-base">Instrucciones importantes</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Separator className="mb-4" />
            <ul className="text-sm text-slate-700 space-y-3 pl-4">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Marca solo los horarios donde <strong>ambos jugadores</strong> están disponibles</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Cualquier miembro de la pareja puede actualizar la disponibilidad</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Puedes agregar notas opcionales (ej: "Solo después de las 18h")</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Los cambios se guardan automáticamente</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Time Slots Availability */}
      {timeSlots.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin horarios disponibles</h3>
            <p className="text-gray-600">
              El organizador aún no ha configurado los horarios para esta fecha.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {timeSlots.map((timeSlot) => (
            <TimeSlotAvailabilityCard
              key={timeSlot.id}
              timeSlot={timeSlot}
              onAvailabilityChange={handleAvailabilityChange}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface TimeSlotAvailabilityCardProps {
  timeSlot: TimeSlot & { my_availability?: { couple_id: string; is_available: boolean; notes?: string | null } }
  onAvailabilityChange: (timeSlotId: string, isAvailable: boolean, notes?: string) => void
  isPending: boolean
}

function TimeSlotAvailabilityCard({
  timeSlot,
  onAvailabilityChange,
  isPending
}: TimeSlotAvailabilityCardProps) {
  const [isAvailable, setIsAvailable] = useState(timeSlot.my_availability?.is_available || false)
  const [notes, setNotes] = useState(timeSlot.my_availability?.notes || '')
  const [hasChanges, setHasChanges] = useState(false)

  const handleAvailabilityToggle = (checked: boolean) => {
    setIsAvailable(checked)
    setHasChanges(true)
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    setHasChanges(true)
  }

  const handleSave = () => {
    onAvailabilityChange(timeSlot.id, isAvailable, notes)
    setHasChanges(false)
  }

  const availableCount = timeSlot.couple_availabilities?.filter(ca => ca.is_available).length || 0
  const totalCouples = timeSlot.couple_availabilities?.length || 0
  const availabilityPercentage = totalCouples > 0 ? (availableCount / totalCouples) * 100 : 0

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${hasChanges ? 'ring-2 ring-blue-500 shadow-lg' : ''} ${isAvailable ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-slate-200'}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="space-y-2 flex-1">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              {formatDateWithWeekday(timeSlot.date)}
            </CardTitle>
            <Separator className="my-2" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <p className="font-semibold text-base">
                {timeSlot.start_time} - {timeSlot.end_time}
              </p>
            </div>
          </div>

          {totalCouples > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 min-w-[140px]">
              <div className="text-xs text-slate-600 font-medium mb-1">Parejas Disponibles</div>
              <div className="text-2xl font-bold text-blue-700 mb-2">
                {availableCount}/{totalCouples}
              </div>
              <Progress value={availabilityPercentage} className="h-2" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {timeSlot.description && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700">{timeSlot.description}</p>
          </div>
        )}

        {/* Availability Toggle */}
        <div className="space-y-4">
          <div className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${isAvailable ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
            <Switch
              id={`available-${timeSlot.id}`}
              checked={isAvailable}
              onCheckedChange={handleAvailabilityToggle}
              disabled={isPending}
              className="data-[state=checked]:bg-green-600"
            />
            <Label
              htmlFor={`available-${timeSlot.id}`}
              className="text-base font-semibold cursor-pointer flex-1"
            >
              Estamos disponibles en este horario
            </Label>
            {timeSlot.my_availability?.is_available && !hasChanges && (
              <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                <Check className="h-3 w-3" />
                <span>Guardado</span>
              </div>
            )}
          </div>

          {/* Notes - Now with Accordion for cleaner look */}
          {isAvailable && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="notes" className="border rounded-lg px-4 bg-slate-50">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium">Agregar notas adicionales (opcional)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-3">
                    <Textarea
                      id={`notes-${timeSlot.id}`}
                      placeholder="Ej: Solo después de las 18h, preferimos temprano, etc."
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      disabled={isPending}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="w-full sm:w-auto gap-2 shadow-md hover:shadow-lg transition-shadow"
              size="lg"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}