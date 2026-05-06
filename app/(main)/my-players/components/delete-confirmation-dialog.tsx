"use client"

import { useState, useTransition } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { deletePlayerAction } from '@/lib/services/players/players.actions'

interface PlayerData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string | null
  score: number | null
  profile_image_url: string | null
  category_name: string | null
}

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: PlayerData
  onPlayerDelete: (playerId: string) => void
}

export default function DeleteConfirmationDialog({
  open,
  onOpenChange,
  player,
  onPlayerDelete
}: DeleteConfirmationDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePlayerAction(player.id)

      if (result.success) {
        toast({
          title: 'Jugador eliminado',
          description: `${player.first_name} ${player.last_name} fue eliminado correctamente`
        })
        onPlayerDelete(player.id)
        onOpenChange(false)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo eliminar el jugador',
          variant: 'destructive'
        })
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará al jugador{' '}
            <span className="font-semibold text-foreground">
              {player.first_name} {player.last_name}
            </span>
            . Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
