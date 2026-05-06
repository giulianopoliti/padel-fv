'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TimeSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  court_name: string | null
  max_matches: number
  availableCouples: {
    couple_id: string
    player1_name: string
    player2_name: string
    is_available: boolean
  }[]
}

interface ScheduleData {
  fecha: {
    id: string
    name: string
    fecha_number: number
  }
  timeSlots: TimeSlot[]
}

interface ScheduleMatrixProps {
  tournamentId: string
  fechaId: string
  isOrganizer: boolean
  userCouple: { id: string; can_edit: boolean } | null
}

export default function ScheduleMatrix({
  tournamentId,
  fechaId,
  isOrganizer,
  userCouple
}: ScheduleMatrixProps) {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSlot, setNewSlot] = useState({
    date: '',
    start_time: '',
    end_time: '',
    court_name: ''
  })

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/tournaments/${tournamentId}/schedules?fecha_id=${fechaId}`
      )
      if (response.ok) {
        const data = await response.json()
        setScheduleData(data)
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTimeSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_id: fechaId,
          ...newSlot
        })
      })
      
      if (response.ok) {
        setNewSlot({ date: '', start_time: '', end_time: '', court_name: '' })
        setShowCreateForm(false)
        fetchSchedules()
      }
    } catch (error) {
      console.error('Error creating time slot:', error)
    }
  }

  const updateAvailability = async (timeSlotId: string, isAvailable: boolean) => {
    if (!userCouple) return
    
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/schedules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couple_id: userCouple.id,
          time_slot_id: timeSlotId,
          is_available: isAvailable
        })
      })
      
      if (response.ok) {
        fetchSchedules()
      }
    } catch (error) {
      console.error('Error updating availability:', error)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [tournamentId, fechaId])

  if (loading) {
    return <div className="text-center py-8">Cargando horarios...</div>
  }

  if (!scheduleData) {
    return <div className="text-center py-8">Error cargando horarios</div>
  }

  const formatTime = (time: string) => {
    return new Date(`1970-01-01T${time}`).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  const isUserAvailableForSlot = (slot: TimeSlot) => {
    if (!userCouple) return false
    return slot.availableCouples.some(
      couple => couple.couple_id === userCouple.id && couple.is_available
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {scheduleData.fecha.name} - Fecha {scheduleData.fecha.fecha_number}
        </h2>
        
        {isOrganizer && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Crear Horario
          </Button>
        )}
      </div>

      {/* Create time slot form */}
      {isOrganizer && showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Horario</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createTimeSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newSlot.date}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="court">Cancha</Label>
                  <Input
                    id="court"
                    placeholder="Ej: Cancha 1"
                    value={newSlot.court_name}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, court_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Hora Inicio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newSlot.start_time}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">Hora Fin</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newSlot.end_time}
                    onChange={(e) => setNewSlot(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Crear Horario</Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Time slots */}
      {scheduleData.timeSlots.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No hay horarios disponibles para esta fecha.</p>
            {isOrganizer && (
              <p className="text-sm text-gray-500 mt-2">
                Crea el primer horario usando el botón "Crear Horario"
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scheduleData.timeSlots.map((slot) => (
            <Card key={slot.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>
                    {formatDate(slot.date)} | {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    {slot.court_name && ` | ${slot.court_name}`}
                  </span>
                  
                  {/* Player availability checkbox */}
                  {userCouple && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`slot-${slot.id}`}
                        checked={isUserAvailableForSlot(slot)}
                        onCheckedChange={(checked) => 
                          updateAvailability(slot.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={`slot-${slot.id}`}>
                        Puedo en este horario
                      </Label>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slot.availableCouples.length === 0 ? (
                  <p className="text-gray-500">No hay parejas disponibles</p>
                ) : (
                  <div>
                    <p className="font-medium mb-2">
                      Parejas disponibles ({slot.availableCouples.length}):
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {slot.availableCouples.map((couple, index) => (
                        <div key={couple.couple_id} className="text-sm bg-gray-50 p-2 rounded">
                          {couple.player1_name} + {couple.player2_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}