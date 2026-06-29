"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RestoreTournamentButtonProps {
  tournamentId: string
  tournamentName: string
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: "No iniciado",
  ZONE_PHASE: "Fase de zonas",
  BRACKET_PHASE: "Fase de llaves",
}

export function RestoreTournamentButton({
  tournamentId,
  tournamentName,
}: RestoreTournamentButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleRestoreTournament = async () => {
    try {
      setIsLoading(true)

      const response = await fetch(`/api/tournaments/${tournamentId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudo descancelar el torneo")
      }

      toast.success(`Torneo restaurado a ${statusLabels[result.status] || result.status}`)
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al descancelar el torneo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-red-200 bg-white text-red-700 shadow-sm hover:bg-red-50"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Descancelar
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Descancelar torneo</DialogTitle>
            <DialogDescription>
              Se restaurara "{tournamentName}" segun sus datos actuales: llaves si tiene
              partidos de bracket, zonas si tiene zonas o partidos de zona, o no iniciado si
              aun no tiene estructura creada.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Volver
            </Button>
            <Button
              type="button"
              onClick={handleRestoreTournament}
              disabled={isLoading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isLoading ? "Restaurando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
