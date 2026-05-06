'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Calendar, Edit, Trash2 } from 'lucide-react'
import { TournamentFecha } from '../../types'
import CreateFechaDialog from './CreateFechaDialog'
import EditFechaDialog from './EditFechaDialog'
import DeleteFechaAlert from './DeleteFechaAlert'

interface FechaManagerProps {
  fechas: TournamentFecha[]
  selectedFechaId: string | null
  onFechaSelect: (fechaId: string) => void
  onFechaCreated: (fecha: TournamentFecha) => void
  onFechaUpdated: (fecha: TournamentFecha) => void
  onFechaDeleted: (fechaId: string) => void
  tournamentId: string
}

export default function FechaManager({
  fechas,
  selectedFechaId,
  onFechaSelect,
  onFechaCreated,
  onFechaUpdated,
  onFechaDeleted,
  tournamentId
}: FechaManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingFecha, setEditingFecha] = useState<TournamentFecha | null>(null)
  const [deletingFecha, setDeletingFecha] = useState<TournamentFecha | null>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Activa</Badge>
      case 'COMPLETED':
        return <Badge variant="secondary">Completada</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelada</Badge>
      default:
        return <Badge variant="outline">Pendiente</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas
            </CardTitle>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Fecha
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="p-4 space-y-3">
              {fechas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay fechas creadas</p>
                  <p className="text-sm">Crea tu primera fecha para comenzar</p>
                </div>
              ) : (
                fechas.map((fecha) => (
                  <Card
                    key={fecha.id}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                      selectedFechaId === fecha.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => onFechaSelect(fecha.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{fecha.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Fecha {fecha.fecha_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingFecha(fecha)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingFecha(fecha)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {getStatusBadge(fecha.status)}

                        {fecha.start_date && (
                          <p className="text-sm text-muted-foreground">
                            {formatDate(fecha.start_date)}
                            {fecha.end_date && fecha.end_date !== fecha.start_date &&
                              ` - ${formatDate(fecha.end_date)}`
                            }
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {(fecha as any)._count_time_slots?.[0]?.count || 0} horarios
                          </span>
                          {fecha.round_type === 'ZONE' && (
                            <Badge variant="outline" className="text-xs">
                              Clasificatoria
                            </Badge>
                          )}
                        </div>

                        {fecha.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {fecha.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateFechaDialog
        tournamentId={tournamentId}
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onFechaCreated={onFechaCreated}
        nextFechaNumber={fechas.length + 1}
      />

      {editingFecha && (
        <EditFechaDialog
          fecha={editingFecha}
          isOpen={!!editingFecha}
          onClose={() => setEditingFecha(null)}
          onFechaUpdated={onFechaUpdated}
        />
      )}

      {deletingFecha && (
        <DeleteFechaAlert
          fecha={deletingFecha}
          isOpen={!!deletingFecha}
          onClose={() => setDeletingFecha(null)}
          onFechaDeleted={onFechaDeleted}
        />
      )}
    </>
  )
}