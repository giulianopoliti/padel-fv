'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Clock,
  Copy,
  Settings,
  Calendar,
  PlayCircle,
  PauseCircle,
  Edit,
  Trash2,
  Info,
  Zap
} from 'lucide-react'
import { TournamentFecha } from '../../schedules/types'
import { UserPermissions } from '@/hooks/use-tournament-permissions'
import CreateTimeSlotModal from '../../schedules/components/CreateTimeSlotModal'

interface ActionsPanelProps {
  selectedFecha: TournamentFecha | undefined
  tournamentId: string
  permissions: UserPermissions
  onFechaUpdated: (fecha: TournamentFecha) => void
  onTimeSlotChanged?: () => void
}

export default function ActionsPanel({
  selectedFecha,
  tournamentId,
  permissions,
  onFechaUpdated,
  onTimeSlotChanged
}: ActionsPanelProps) {
  const [showCreateTimeSlot, setShowCreateTimeSlot] = useState(false)
  const [showBatchCreator, setShowBatchCreator] = useState(false)
  const router = useRouter()

  if (!permissions.hasPermission) {
    return (
      <div className="h-full bg-gray-50 p-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para gestionar este torneo.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!selectedFecha) {
    return (
      <div className="h-full bg-gray-50 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Acciones
            </CardTitle>
            <CardDescription>
              Selecciona una fecha para ver las acciones disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Las acciones aparecerán aquí cuando selecciones una fecha
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowCreateTimeSlot(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Horario
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowBatchCreator(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Crear Múltiples Horarios
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                <Copy className="h-4 w-4 mr-2" />
                Clonar desde Otra Fecha
              </Button>
            </CardContent>
          </Card>

          {/* Fecha Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Gestión de Fecha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar Fecha
              </Button>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Estado de la Fecha</p>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Activar Fecha
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pausar Fecha
                </Button>
              </div>

              <Separator />

              <Button
                size="sm"
                variant="destructive"
                className="w-full justify-start"
                disabled
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Fecha
              </Button>
            </CardContent>
          </Card>

          {/* Fecha Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Información
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Nombre:</span>
                  <p className="text-gray-600 mt-1">{selectedFecha.name}</p>
                </div>

                {selectedFecha.description && (
                  <div>
                    <span className="font-medium text-gray-700">Descripción:</span>
                    <p className="text-gray-600 mt-1 text-xs leading-relaxed">
                      {selectedFecha.description}
                    </p>
                  </div>
                )}

                <div>
                  <span className="font-medium text-gray-700">Tipo:</span>
                  <p className="text-gray-600 mt-1">
                    {selectedFecha.is_qualifying ? 'Clasificatoria' : 'Eliminatoria'}
                  </p>
                </div>

                <div>
                  <span className="font-medium text-gray-700">Número:</span>
                  <p className="text-gray-600 mt-1">#{selectedFecha.fecha_number}</p>
                </div>

                {selectedFecha.start_date && (
                  <div>
                    <span className="font-medium text-gray-700">Fechas:</span>
                    <p className="text-gray-600 mt-1">
                      {new Date(selectedFecha.start_date).toLocaleDateString('es-ES')}
                      {selectedFecha.end_date && selectedFecha.end_date !== selectedFecha.start_date &&
                        ` - ${new Date(selectedFecha.end_date).toLocaleDateString('es-ES')}`
                      }
                    </p>
                  </div>
                )}

                {selectedFecha.max_matches_per_couple && (
                  <div>
                    <span className="font-medium text-gray-700">Máx. partidos por pareja:</span>
                    <p className="text-gray-600 mt-1">{selectedFecha.max_matches_per_couple}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Ayuda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs text-gray-600">
                <div>
                  <p className="font-medium text-gray-700 mb-1">💡 Consejos:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Crea horarios específicos para cada fecha</li>
                    <li>Las parejas podrán marcar disponibilidad</li>
                    <li>Usa "Crear Múltiples" para ahorrar tiempo</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-gray-700 mb-1">📋 Flujo recomendado:</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Crear fechas del torneo</li>
                    <li>Agregar horarios por fecha</li>
                    <li>Las parejas marcan disponibilidad</li>
                    <li>Generar horarios de partidos</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>

      {/* Modals */}
      {selectedFecha && (
        <>
          <CreateTimeSlotModal
            isOpen={showCreateTimeSlot}
            onClose={() => setShowCreateTimeSlot(false)}
            fechaId={selectedFecha.id}
            onSuccess={() => {
              console.log('[ActionsPanel] Time slot created successfully, refreshing page')
              setShowCreateTimeSlot(false)
              router.refresh()
            }}
          />

          {/* TODO: Implement BatchTimeSlotCreator */}
          {showBatchCreator && (
            <div>
              {/* Placeholder for batch creator modal */}
            </div>
          )}
        </>
      )}
    </div>
  )
}