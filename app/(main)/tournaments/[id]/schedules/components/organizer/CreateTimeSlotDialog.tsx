'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Clock, Loader2, AlertCircle, Calendar, MapPin } from 'lucide-react'
import { createTimeSlot } from '../../../schedule-management/actions'
import type { CreateTimeSlotData } from '../../types'
import { toast } from 'sonner'

const createTimeSlotSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  start_time: z.string().min(1, 'La hora de inicio es requerida'),
  end_time: z.string().min(1, 'La hora de fin es requerida'),
  court_name: z.string().optional(),
  description: z.string().optional(),
  max_matches: z.number().min(1, 'Debe haber al menos 1 partido').max(5, 'Máximo 5 partidos simultáneos').default(1),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time
  }
  return true
}, {
  message: "La hora de fin debe ser posterior a la hora de inicio",
  path: ["end_time"],
})

type CreateTimeSlotFormData = z.infer<typeof createTimeSlotSchema>

interface CreateTimeSlotDialogProps {
  fechaId: string
  isOpen: boolean
  onClose: () => void
  onTimeSlotCreated: () => void
}

export default function CreateTimeSlotDialog({
  fechaId,
  isOpen,
  onClose,
  onTimeSlotCreated
}: CreateTimeSlotDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateTimeSlotFormData>({
    resolver: zodResolver(createTimeSlotSchema),
    defaultValues: {
      date: '',
      start_time: '',
      end_time: '',
      court_name: '',
      description: '',
      max_matches: 1,
    },
  })

  const onSubmit = async (data: CreateTimeSlotFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const timeSlotData: CreateTimeSlotData = {
        fecha_id: fechaId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        court_name: data.court_name,
        description: data.description,
        max_matches: data.max_matches,
      }

      const result = await createTimeSlot(timeSlotData)

      if (result.success) {
        onTimeSlotCreated()
        toast.success('Horario creado exitosamente')
        form.reset()
        onClose()
      } else {
        throw new Error(result.error || 'Error desconocido al crear el horario')
      }

    } catch (error: any) {
      console.error('Error creating time slot:', error)
      setError(error.message || 'Error al crear el horario. Intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset()
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Crear Nuevo Horario
          </DialogTitle>
          <DialogDescription>
            Configura un nuevo horario para que las parejas puedan marcar su disponibilidad.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha del Horario *
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Inicio *</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Fin *</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Court Name */}
            <FormField
              control={form.control}
              name="court_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Nombre de Cancha (opcional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ej: Cancha 1, Cancha Principal..."
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Matches */}
            <FormField
              control={form.control}
              name="max_matches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partidos Simultáneos</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        disabled={isSubmitting}
                        className="w-20"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                      <span className="text-sm text-muted-foreground">
                        partidos al mismo tiempo
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ej: Horario de mañana, canchas exteriores..."
                      disabled={isSubmitting}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">¿Cómo funciona?</p>
                  <ul className="text-xs space-y-1">
                    <li>• Las parejas inscritas podrán marcar su disponibilidad</li>
                    <li>• Solo las parejas disponibles podrán jugar en este horario</li>
                    <li>• Puedes programar múltiples partidos simultáneos</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
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
        </Form>
      </DialogContent>
    </Dialog>
  )
}