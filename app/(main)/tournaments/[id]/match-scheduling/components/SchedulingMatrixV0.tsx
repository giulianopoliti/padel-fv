'use client'

import React from 'react'
import { Clock } from 'lucide-react'
import { SchedulingData } from '../actions'
import AvailabilityMatrix from './AvailabilityMatrix'
import MatchCreationPanel from './MatchCreationPanel'
import ScheduledMatchesDataTable from './ScheduledMatchesDataTable'
import { useMatchScheduling } from '../hooks/useMatchScheduling'

interface SchedulingMatrixV0Props {
  fechaId: string
  schedulingData: SchedulingData
  onMatchCreated: () => void
  onMatchResultSaved?: () => void
  clubes: Club[]
}

interface Club {
  id: string
  name: string
}

const SchedulingMatrixV0: React.FC<SchedulingMatrixV0Props> = ({
  fechaId,
  schedulingData,
  onMatchCreated,
  onMatchResultSaved,
  clubes
}) => {
  const {
    couples,
    timeSlots,
    availability,
    selectedCouples,
    createdMatches,
    draggedCouple,
    error,
    actions
  } = useMatchScheduling(schedulingData, fechaId, onMatchCreated)

  const handleMatchResultSaved = () => {
    if (onMatchResultSaved) {
      onMatchResultSaved()
    }
  }

  if (timeSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay horarios configurados</h3>
        <p className="text-slate-500">
          Primero debes crear horarios para esta fecha en la sección de "Fechas & Horarios"
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
            Programación de Partidos - Matriz Unificada
          </h1>
          <p className="text-slate-600">Todos los horarios disponibles en una sola matriz</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <AvailabilityMatrix
              couples={couples}
              timeSlots={timeSlots}
              availability={availability}
              draggedCouple={draggedCouple}
              onCoupleSelect={actions.handleCoupleSelect}
              onDragStart={actions.handleDragStart}
              onDragEnd={actions.handleDragEnd}
            />
          </div>

          <div>
            <MatchCreationPanel
              selectedCouples={selectedCouples}
              createdMatches={[]}
              timeSlots={timeSlots}
              error={error}
              onCoupleRemove={actions.handleCoupleRemove}
              onMatchCreate={actions.handleCreateMatch}
              onMatchDelete={actions.handleDeleteMatch}
              onDragOver={actions.handleDragOver}
              onDrop={actions.handleDrop}
              showMatchesList={false}
              clubes={clubes}
            />
          </div>
        </div>

        <div className="w-full">
          <ScheduledMatchesDataTable
            createdMatches={createdMatches}
            onMatchDelete={actions.handleDeleteMatch}
            onMatchResultSaved={handleMatchResultSaved}
            onUpdateMatchResult={actions.handleUpdateMatchResult}
            onModifyMatchResult={actions.handleModifyMatchResult}
            onModifySchedule={actions.handleModifySchedule}
            onScheduleModified={handleMatchResultSaved} // Reuse same callback since both trigger refresh
            clubes={clubes}
          />
        </div>
      </div>
    </div>
  )
}

export default SchedulingMatrixV0
