'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Activity, Info } from 'lucide-react'

interface TournamentStatusSectionProps {
  tournamentId: string
  currentStatus: string
}

const STATUS_CONFIG = {
  NOT_STARTED: {
    label: 'No Iniciado',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    description: 'El torneo aún no ha comenzado'
  },
  IN_PROGRESS: {
    label: 'En Progreso',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'El torneo está actualmente en curso'
  },
  COMPLETED: {
    label: 'Finalizado',
    color: 'bg-green-100 text-green-800 border-green-300',
    description: 'El torneo ha concluido'
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800 border-red-300',
    description: 'El torneo fue cancelado'
  }
} as const

export default function TournamentStatusSection({
  tournamentId,
  currentStatus
}: TournamentStatusSectionProps) {
  const [status, setStatus] = useState(currentStatus)

  const statusInfo = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_STARTED

  // TODO: Implementar funcionalidad de cambio de estado
  // Cuando se implemente, agregar:
  // - Validaciones de transición de estados
  // - Confirmación de cambio de estado
  // - Server action para actualizar en BD
  // - Manejo de errores y loading states

  const handleStatusChange = (newStatus: string) => {
    // Por ahora solo actualiza el estado local
    setStatus(newStatus)
    // TODO: Llamar a server action cuando esté implementado
    // await updateTournamentStatus(tournamentId, newStatus)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Activity className="h-5 w-5 text-purple-600 mt-1" />
          <div>
            <CardTitle>Estado del Torneo</CardTitle>
            <CardDescription>
              Gestiona el estado actual del torneo americano
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado actual */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Estado Actual</Label>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`px-3 py-1 ${statusInfo.color} font-medium`}
            >
              {statusInfo.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {statusInfo.description}
            </span>
          </div>
        </div>

        {/* Selector de estado (disabled por ahora) */}
        <div className="space-y-2">
          <Label htmlFor="status-select" className="text-sm font-medium">
            Cambiar Estado
          </Label>
          <Select
            value={status}
            onValueChange={handleStatusChange}
            disabled={true}
          >
            <SelectTrigger id="status-select" className="w-full sm:w-[280px]">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">
                {STATUS_CONFIG.NOT_STARTED.label}
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                {STATUS_CONFIG.IN_PROGRESS.label}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {STATUS_CONFIG.COMPLETED.label}
              </SelectItem>
              <SelectItem value="CANCELLED">
                {STATUS_CONFIG.CANCELLED.label}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alert informativo */}
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            <strong>Próximamente:</strong> La funcionalidad de cambio de estado estará disponible
            en una futura actualización. Esta sección te permitirá controlar el ciclo de vida
            del torneo americano.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
