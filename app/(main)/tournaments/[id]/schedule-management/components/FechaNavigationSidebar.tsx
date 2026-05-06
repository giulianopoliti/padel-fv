'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Plus,
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Circle,
  Trophy,
  Target
} from 'lucide-react'
import { TournamentFecha } from '../../schedules/types'
import { UserPermissions } from '@/hooks/use-tournament-permissions'
import InlineCreateFechaForm from './InlineCreateFechaForm'

// Mapeo de rounds a UI amigable
const ROUND_LABELS: Record<string, string> = {
  'ZONE': 'Qually',
  '32VOS': '32vos de Final',
  '16VOS': '16vos de Final',
  '8VOS': 'Octavos de Final',
  '4TOS': 'Cuartos de Final',
  'SEMIFINAL': 'Semifinal',
  'FINAL': 'Final'
}

interface FechaNavigationSidebarProps {
  fechas: TournamentFecha[]
  selectedFechaId: string | null
  onFechaSelect: (fechaId: string) => void
  onFechaCreated: (fecha: TournamentFecha) => void
  onFechaUpdated: (fecha: TournamentFecha) => void
  onFechaDeleted: (fechaId: string) => void
  tournamentId: string
  permissions: UserPermissions
  isLoading: boolean
}

export default function FechaNavigationSidebar({
  fechas,
  selectedFechaId,
  onFechaSelect,
  onFechaCreated,
  onFechaUpdated,
  onFechaDeleted,
  tournamentId,
  permissions,
  isLoading
}: FechaNavigationSidebarProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [expandedFechas, setExpandedFechas] = useState<Set<string>>(new Set())
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createFechaUrl = (fechaId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('fecha_id', fechaId)
    return `${pathname}?${params.toString()}`
  }

  const toggleExpanded = (fechaId: string) => {
    setExpandedFechas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fechaId)) {
        newSet.delete(fechaId)
      } else {
        newSet.add(fechaId)
      }
      return newSet
    })
  }

  const getFechaStatus = (fecha: TournamentFecha) => {
    // TODO: Calculate based on time slots count
    const hasTimeSlots = false // Placeholder
    const isComplete = hasTimeSlots

    if (isComplete) return 'complete'
    if (hasTimeSlots) return 'partial'
    return 'empty'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600'
      case 'partial': return 'text-yellow-600'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return CheckCircle2
      case 'partial': return AlertCircle
      default: return Circle
    }
  }

  const getProgressValue = (fecha: TournamentFecha) => {
    // TODO: Calculate actual progress based on time slots
    const status = getFechaStatus(fecha)
    switch (status) {
      case 'complete': return 100
      case 'partial': return 60
      default: return 0
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Fechas del Torneo
          </h2>
          <Badge variant="secondary" className="text-xs">
            {fechas.length}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-white rounded border">
            <div className="font-medium text-gray-900">{fechas.length}</div>
            <div className="text-gray-500">Fechas</div>
          </div>
          <div className="text-center p-2 bg-white rounded border">
            <div className="font-medium text-gray-900">
              {fechas.filter(f => getFechaStatus(f) === 'complete').length}
            </div>
            <div className="text-gray-500">Completas</div>
          </div>
        </div>
      </div>

      {/* Fecha List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {fechas.map((fecha) => {
            const status = getFechaStatus(fecha)
            const StatusIcon = getStatusIcon(status)
            const isSelected = selectedFechaId === fecha.id
            const isExpanded = expandedFechas.has(fecha.id)
            const progress = getProgressValue(fecha)

            return (
              <Card
                key={fecha.id}
                className={cn(
                  "transition-all duration-200",
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-200 shadow-md'
                    : 'hover:shadow-sm hover:border-gray-300'
                )}
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(fecha.id)}>
                  <Link href={createFechaUrl(fecha.id)} className="block">
                    <CardHeader className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${getStatusColor(status)}`} />
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium text-gray-900 truncate">
                              {fecha.name}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                {fecha.round_type === 'ZONE' ? (
                                  <Target className="h-3 w-3 text-blue-600" />
                                ) : (
                                  <Trophy className="h-3 w-3 text-amber-600" />
                                )}
                                <Badge
                                  variant={fecha.round_type === 'ZONE' ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {ROUND_LABELS[fecha.round_type]}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-500">
                                #{fecha.fecha_number}
                              </span>
                            </div>
                          </div>
                        </div>

                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Configuración</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </CardHeader>
                  </Link>

                  <CollapsibleContent>
                    <CardContent className="pt-0 p-3">
                      <div className="text-xs text-gray-600 space-y-1">
                        {fecha.description && (
                          <p className="line-clamp-2">{fecha.description}</p>
                        )}

                        {fecha.start_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(fecha.start_date).toLocaleDateString()}
                              {fecha.end_date && fecha.end_date !== fecha.start_date &&
                                ` - ${new Date(fecha.end_date).toLocaleDateString()}`
                              }
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>0 horarios configurados</span> {/* TODO: Real count */}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )
          })}

          {/* Create New Fecha */}
          {isCreating ? (
            <InlineCreateFechaForm
              tournamentId={tournamentId}
              nextFechaNumber={fechas.length + 1}
              onSuccess={(newFecha) => {
                onFechaCreated(newFecha)
                setIsCreating(false)
              }}
              onCancel={() => setIsCreating(false)}
            />
          ) : (
            permissions.hasPermission && !isLoading && (
              <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
                <CardContent className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreating(true)}
                    className="w-full justify-start text-gray-600 hover:text-gray-900"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Nueva Fecha
                  </Button>
                </CardContent>
              </Card>
            )
          )}

          {/* Empty State */}
          {fechas.length === 0 && !isCreating && (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Sin fechas configuradas
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Crea la primera fecha para organizar tu torneo
                </p>
                {permissions.hasPermission && !isLoading && (
                  <Button
                    size="sm"
                    onClick={() => setIsCreating(true)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Crear Primera Fecha
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}