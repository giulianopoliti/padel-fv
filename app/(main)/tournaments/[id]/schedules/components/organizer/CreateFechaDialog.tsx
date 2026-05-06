'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Calendar, Loader2, AlertCircle } from 'lucide-react'
import { TournamentFecha } from '../../types'
import { createTournamentFecha } from '../../../schedule-management/actions'
import type { CreateFechaData } from '../../../schedule-management/types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'


// Definir tipos base fuera del componente para evitar problemas de ciclo
const baseCreateFechaSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  round_type: z.enum(['ZONE', '32VOS', '16VOS', '8VOS', '4TOS', 'SEMIFINAL', 'FINAL']).default('ZONE'),
  max_matches_per_couple: z.number().min(1).max(10).default(3),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date)
  }
  return true
}, {
  message: "La fecha de fin debe ser posterior a la fecha de inicio",
  path: ["end_date"],
})

type CreateFechaFormData = z.infer<typeof baseCreateFechaSchema>

interface CreateFechaDialogProps {
  tournamentId: string
  isOpen: boolean
  onClose: () => void
  onFechaCreated: (fecha: TournamentFecha) => void
  nextFechaNumber: number
}

export default function CreateFechaDialog({
  tournamentId,
  isOpen,
  onClose,
  onFechaCreated,
  nextFechaNumber
}: CreateFechaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado para rondas disponibles
  const [availableRounds, setAvailableRounds] = useState<string[]>(['ZONE']) // Siempre incluir ZONE
  const [roundsLoading, setRoundsLoading] = useState(false)

  // Función simple para obtener solo las rondas del bracket
  useEffect(() => {
    const fetchAvailableRounds = async () => {
      setRoundsLoading(true)
      try {
        const supabase = createClientComponentClient()

        // Solo obtener las rondas únicas de los matches
        const { data: matches, error } = await supabase
          .from('matches')
          .select('round')
          .eq('tournament_id', tournamentId)
          .not('round', 'is', null)

        if (error) {
          console.error('Error fetching rounds:', error)
          return
        }

        const bracketRounds = new Set<string>()
        matches?.forEach(match => {
          if (match.round) {
            bracketRounds.add(match.round)
          }
        })

        // Siempre incluir ZONE (para clasificatorias/qualify) + rondas del bracket
        const allRounds = new Set(['ZONE', ...Array.from(bracketRounds)])

        // Ordenar por jerarquía
        const orderedRounds = ['ZONE', '32VOS', '16VOS', '8VOS', '4TOS', 'SEMIFINAL', 'FINAL']
        const sortedRounds = Array.from(allRounds).sort((a, b) => {
          return orderedRounds.indexOf(a) - orderedRounds.indexOf(b)
        })

        setAvailableRounds(sortedRounds)

      } catch (error) {
        console.error('Error fetching available rounds:', error)
      } finally {
        setRoundsLoading(false)
      }
    }

    if (tournamentId) {
      fetchAvailableRounds()
    }
  }, [tournamentId])

  // Crear esquema dinámico basado en rondas disponibles
  const dynamicCreateFechaSchema = useMemo(() => {
    const availableRoundValues = availableRounds.length > 0
      ? availableRounds as Array<'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL'>
      : ['ZONE'] as const // fallback si no hay rondas

    return z.object({
      name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
      description: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      round_type: z.enum(availableRoundValues as [string, ...string[]]).default(availableRoundValues[0] || 'ZONE'),
      max_matches_per_couple: z.number().min(1).max(10).default(3),
    }).refine((data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date)
      }
      return true
    }, {
      message: "La fecha de fin debe ser posterior a la fecha de inicio",
      path: ["end_date"],
    })
  }, [availableRounds])

  const form = useForm<CreateFechaFormData>({
    resolver: zodResolver(dynamicCreateFechaSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      round_type: availableRounds[0] || 'ZONE',
      max_matches_per_couple: 3,
    },
  })

  const onSubmit = async (data: CreateFechaFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const fechaData: CreateFechaData = {
        tournament_id: tournamentId,
        fecha_number: nextFechaNumber,
        name: data.name,
        description: data.description || undefined,
        start_date: data.start_date || undefined,
        end_date: data.end_date || undefined,
        round_type: data.round_type,
        max_matches_per_couple: data.max_matches_per_couple,
      }

      const result = await createTournamentFecha(fechaData)

      if (result.success && result.data) {
        onFechaCreated(result.data as TournamentFecha)
        toast.success(`Fecha ${nextFechaNumber} creada exitosamente`)
        form.reset()
        onClose()
      } else {
        throw new Error(result.error || 'Error desconocido al crear la fecha')
      }

    } catch (error: any) {
      console.error('Error creating fecha:', error)
      setError(error.message || 'Error al crear la fecha. Intenta nuevamente.')
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
            <Calendar className="h-5 w-5 text-blue-600" />
            Nueva Fecha del Torneo
          </DialogTitle>
          <DialogDescription>
            Crea una nueva fecha para organizar los partidos del torneo.
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

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Fecha *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ej: Clasificatorias, Cuartos de Final..."
                      disabled={isSubmitting}
                      {...field}
                    />
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
                      placeholder="Detalles adicionales sobre esta fecha..."
                      disabled={isSubmitting}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Inicio</FormLabel>
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

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Fin</FormLabel>
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
            </div>

            {/* Max Matches per Couple */}
            <FormField
              control={form.control}
              name="max_matches_per_couple"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máximo partidos por pareja</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      disabled={isSubmitting}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Round Type - Dinámico basado en bracket */}
            <FormField
              control={form.control}
              name="round_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Ronda</FormLabel>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSubmitting || roundsLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {roundsLoading ? (
                        <option value="">Cargando rondas disponibles...</option>
                      ) : availableRounds.length > 0 ? (
                        availableRounds.map((round) => {
                          const labels: Record<string, string> = {
                            'ZONE': 'QUALLY (Clasificatoria)',
                            '32VOS': '32vos de Final',
                            '16VOS': '16vos de Final',
                            '8VOS': '8vos de Final',
                            '4TOS': 'Cuartos de Final',
                            'SEMIFINAL': 'Semifinal',
                            'FINAL': 'Final'
                          }
                          return (
                            <option key={round} value={round}>
                              {labels[round] || round}
                            </option>
                          )
                        })
                      ) : (
                        <option value="ZONE">QUALLY (Clasificatoria) - Por defecto</option>
                      )}
                    </select>
                  </FormControl>
                  <FormMessage />
                  {availableRounds.length === 0 && !roundsLoading && (
                    <p className="text-sm text-muted-foreground">
                      No se encontraron rondas en el bracket. Se usará "Zona" por defecto.
                    </p>
                  )}
                  {availableRounds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Rondas disponibles basadas en el bracket del torneo: {availableRounds.join(', ')}
                    </p>
                  )}
                </FormItem>
              )}
            />

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
                  'Crear Fecha'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}