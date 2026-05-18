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
import { AlertCircle, Calendar, Clock, Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { createTimeSlot } from '../../../schedule-management/actions'
import type { CreateTimeSlotData } from '../../types'

const createTimeSlotSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  start_time: z.string().min(1, 'La hora de inicio es requerida'),
  end_time: z.string().min(1, 'La hora de fin es requerida'),
  court_name: z.string().optional(),
  description: z.string().optional(),
  max_matches: z
    .number()
    .min(1, 'Debe haber al menos 1 partido')
    .max(5, 'Máximo 5 partidos simultáneos')
    .default(1),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time
  }

  return true
}, {
  message: 'La hora de fin debe ser posterior a la hora de inicio',
  path: ['end_time'],
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
  onTimeSlotCreated,
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
        return
      }

      throw new Error(result.error || 'Error desconocido al crear el horario')
    } catch (submitError: any) {
      console.error('Error creating time slot:', submitError)
      setError(submitError.message || 'Error al crear el horario. Intenta nuevamente.')
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4 text-blue-600" />
            Crear nuevo horario
          </DialogTitle>
          <DialogDescription className="text-sm">
            Mantenemos la misma configuración, pero en un formulario más compacto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      Fecha *
                    </FormLabel>
                    <FormControl>
                      <Input type="date" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_matches"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Simultáneos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        disabled={isSubmitting}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">1 a 5 partidos</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Hora inicio *</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
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
                    <FormLabel className="text-sm">Hora fin *</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="court_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    Cancha
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Cancha 1 o Principal"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: horario de mañana o canchas exteriores"
                      disabled={isSubmitting}
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="flex items-start gap-2 text-xs text-blue-800">
                <Clock className="mt-0.5 h-4 w-4 text-blue-600" />
                <p>
                  Las parejas podrán marcar disponibilidad para este horario y podés habilitar entre 1 y 5 partidos simultáneos.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear horario'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
