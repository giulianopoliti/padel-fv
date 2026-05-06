"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw, Ban } from "lucide-react"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import {
  cancelTournamentAction,
  backToNotStartedAction,
  backToZonesAction
} from "@/app/api/admin/tournaments/actions"
import { useToast } from "@/components/ui/use-toast"

interface TournamentActionsMenuProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
  onActionComplete: () => void
}

export const TournamentActionsMenu = ({
  tournamentId,
  tournamentName,
  tournamentStatus,
  onActionComplete
}: TournamentActionsMenuProps) => {
  const { toast } = useToast()
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: "cancel" | "backToNotStarted" | "backToZones" | null
    title: string
    description: string
  }>({ isOpen: false, action: null, title: "", description: "" })
  const [isExecuting, setIsExecuting] = useState(false)

  const handleCancelTournament = () => {
    setConfirmDialog({
      isOpen: true,
      action: "cancel",
      title: "Cancelar Torneo",
      description: `¿Estás seguro de cancelar el torneo "${tournamentName}"? Esta acción marcará el torneo como CANCELADO.`
    })
  }

  const handleBackToNotStarted = () => {
    setConfirmDialog({
      isOpen: true,
      action: "backToNotStarted",
      title: "Volver a No Iniciado",
      description: `⚠️ ADVERTENCIA: Esta acción eliminará TODAS las zonas, partidos de zona, y datos relacionados del torneo "${tournamentName}". El torneo volverá al estado NOT_STARTED. Esta acción NO se puede deshacer.`
    })
  }

  const handleBackToZones = () => {
    setConfirmDialog({
      isOpen: true,
      action: "backToZones",
      title: "Volver a Fase de Zonas",
      description: `⚠️ ADVERTENCIA: Esta acción eliminará el bracket completo, seeds, jerarquía de partidos, y todos los partidos de bracket del torneo "${tournamentName}". El torneo volverá al estado ZONE_PHASE. Los datos de zona se mantendrán intactos. Esta acción NO se puede deshacer.`
    })
  }

  const executeAction = async () => {
    if (!confirmDialog.action) return

    setIsExecuting(true)

    try {
      let result

      switch (confirmDialog.action) {
        case "cancel":
          result = await cancelTournamentAction(tournamentId)
          break
        case "backToNotStarted":
          result = await backToNotStartedAction(tournamentId)
          break
        case "backToZones":
          result = await backToZonesAction(tournamentId)
          break
        default:
          return
      }

      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message || "Acción ejecutada correctamente"
        })
        setConfirmDialog({ isOpen: false, action: null, title: "", description: "" })
        onActionComplete()
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al ejecutar la acción",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error inesperado al ejecutar la acción",
        variant: "destructive"
      })
    } finally {
      setIsExecuting(false)
    }
  }

  // Determinar qué botones mostrar según el estado
  const showBackToNotStarted = tournamentStatus === "ZONE_PHASE"
  const showBackToZones = tournamentStatus === "BRACKET_PHASE"
  const showCancel = !["FINISHED", "CANCELED"].includes(tournamentStatus)

  // Si no hay acciones disponibles, no mostrar nada
  if (!showBackToNotStarted && !showBackToZones && !showCancel) {
    return (
      <div className="text-sm text-slate-500">
        No hay acciones disponibles para este estado
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showBackToNotStarted && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToNotStarted}
          className="justify-start border-orange-200 text-orange-700 hover:bg-orange-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Volver a No Iniciado
        </Button>
      )}

      {showBackToZones && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToZones}
          className="justify-start border-yellow-200 text-yellow-700 hover:bg-yellow-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Volver a Fase de Zonas
        </Button>
      )}

      {showCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelTournament}
          className="justify-start border-red-200 text-red-700 hover:bg-red-50"
        >
          <Ban className="h-4 w-4 mr-2" />
          Cancelar Torneo
        </Button>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, title: "", description: "" })}
        onConfirm={executeAction}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={isExecuting ? "Ejecutando..." : "Confirmar"}
      />
    </div>
  )
}
