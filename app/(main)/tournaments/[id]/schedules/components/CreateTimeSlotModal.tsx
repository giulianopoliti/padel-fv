'use client'

import { useState, useTransition, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calendar, Clock, MapPin, Hash } from 'lucide-react'
import { createTimeSlot } from '../actions'
import { CreateTimeSlotData } from '../types'

interface CreateTimeSlotModalProps {
  isOpen: boolean
  onClose: () => void
  fechaId: string
  onSuccess?: () => void
}

export default function CreateTimeSlotModal({
  isOpen,
  onClose,
  fechaId,
  onSuccess
}: CreateTimeSlotModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateTimeSlotData>({
    fecha_id: fechaId,
    date: '',
    start_time: '',
    end_time: '',
    max_matches: 1,
    description: ''
  })
  
  // Debug logging
  console.log('[CreateTimeSlotModal] Received fechaId:', fechaId)

  // Update formData when fechaId changes
  useEffect(() => {
    console.log('[CreateTimeSlotModal] fechaId changed, updating formData.fecha_id from', formData.fecha_id, 'to', fechaId)
    setFormData(prev => ({ ...prev, fecha_id: fechaId }))
  }, [fechaId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        console.log('[CreateTimeSlotModal] About to call createTimeSlot with formData:', formData)
        const result = await createTimeSlot(formData)
        
        if (result.success) {
          // Reset form
          setFormData({
            fecha_id: fechaId,
            date: '',
            start_time: '',
            end_time: '',
            max_matches: 1,
            description: ''
          })
          onSuccess?.()
          onClose()
        } else {
          setError(result.error || 'Error al crear el horario')
        }
      } catch (err) {
        setError('Error inesperado al crear el horario')
        console.error('Error creating time slot:', err)
      }
    })
  }

  const handleClose = () => {
    if (!isPending) {
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Crear Nuevo Horario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date and Court */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {/* Start and End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora Inicio</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                required
                disabled={isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora Fin</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {/* Max Matches */}
          <div className="space-y-2">
            <Label htmlFor="max_matches" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Partidos Simultáneos
            </Label>
            <Input
              id="max_matches"
              type="number"
              min="1"
              max="10"
              value={formData.max_matches}
              onChange={(e) => setFormData(prev => ({ ...prev, max_matches: parseInt(e.target.value) || 1 }))}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Ej: Horario de mañana, canchas exteriores..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={isPending}
              rows={2}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Horario'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}