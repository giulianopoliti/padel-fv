"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, XCircle, Edit, Trophy, Trash2, FastForward } from "lucide-react";
import { Database } from "@/database.types";
import StartMatchDialog from "./start-match-dialog";
// Avoid importing server actions directly
import { useToast } from "@/components/ui/use-toast";

type MatchStatus = Database["public"]["Enums"]["match_status"];

interface MatchActionsMenuProps {
  matchId: string;
  tournamentId: string;
  status: MatchStatus;
  court?: string | null;
  matchInfo?: {
    couple1?: string;
    couple2?: string;
    hasRealCouple1?: boolean;
    hasRealCouple2?: boolean;
    isPlaceholder1?: boolean;
    isPlaceholder2?: boolean;
  };
  onUpdateMatch: (matchId: string, data: { status?: MatchStatus; court?: string }) => Promise<void>;
  onMatchDeleted?: () => void;
  isOwner: boolean;
  onOpenResultDialog: () => void;
}

export default function MatchActionsMenu({
  matchId,
  tournamentId,
  status,
  court,
  matchInfo,
  onUpdateMatch,
  onMatchDeleted,
  isOwner,
  onOpenResultDialog
}: MatchActionsMenuProps) {
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const { toast } = useToast();

  // Si no es propietario, no mostrar el menú
  if (!isOwner) {
    return null;
  }

  const handleStartMatch = async (courtNumber: string) => {
    await onUpdateMatch(matchId, {
      status: "IN_PROGRESS",
      court: courtNumber
    });
  };



  const handleCancelMatch = async () => {
    await onUpdateMatch(matchId, {
      status: "CANCELED"
    });
  };

  const handleEditCourt = async () => {
    // Para simplificar, vamos a usar un prompt por ahora
    // En una implementación más completa, se podría usar un dialog
    const newCourt = prompt("Ingresa el nuevo número de cancha:", court || "");
    if (newCourt !== null && newCourt.trim() !== "") {
      await onUpdateMatch(matchId, {
        court: newCourt.trim()
      });
    }
  };

  const handleDeleteMatch = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar este partido? Esta acción no se puede deshacer.")) {
      return;
    }

      try {
      const resp = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })
      const result = await resp.json()
      if (resp.ok && result.success) {
        toast({
          title: "Partido eliminado",
          description: result.message || "El partido ha sido eliminado correctamente",
          variant: "default"
        });
        if (onMatchDeleted) {
          onMatchDeleted();
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo eliminar el partido",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting match:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al eliminar el partido",
        variant: "destructive"
      });
    }
  };

  const handleProcessBye = async () => {
    try {
      const resp = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/process-bye`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await resp.json();
      
      if (resp.ok && result.success) {
        toast({
          title: "Procesado exitosamente",
          description: result.message || "El ganador ha sido procesado y avanzado automáticamente",
          variant: "default"
        });
        
        // Actualizar el estado del match
        if (result.processed) {
          await onUpdateMatch(matchId, { status: 'FINISHED' });
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo procesar el ganador",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error processing BYE:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al procesar el ganador",
        variant: "destructive"
      });
    }
  };

  const getAvailableActions = () => {
    const actions = [];

    // Detectar si es elegible para "Procesar Ganador"
    const hasRealCouple1 = matchInfo?.hasRealCouple1 ?? false;
    const hasRealCouple2 = matchInfo?.hasRealCouple2 ?? false;
    const isBye = (hasRealCouple1 && !hasRealCouple2) || (!hasRealCouple1 && hasRealCouple2);
    const canProcessWinner = isBye || (hasRealCouple1 && hasRealCouple2);

    switch (status) {
      case "PENDING":
        // Agregar "Procesar Ganador" solo si es BYE o match completo
        if (canProcessWinner) {
          actions.push({
            label: isBye ? "Procesar BYE" : "Marcar Listo",
            icon: FastForward,
            onClick: handleProcessBye,
            className: "text-emerald-600 hover:text-emerald-700"
          });
        }
        
        actions.push(
          {
            label: "Iniciar Partido",
            icon: Play,
            onClick: () => setStartDialogOpen(true),
            className: "text-blue-600 hover:text-blue-700"
          },
          {
            label: "Cancelar Partido",
            icon: XCircle,
            onClick: handleCancelMatch,
            className: "text-red-600 hover:text-red-700"
          },
          {
            label: "Eliminar Partido",
            icon: Trash2,
            onClick: handleDeleteMatch,
            className: "text-red-600 hover:text-red-700"
          }
        );
        break;

      case "IN_PROGRESS":
        actions.push(
          {
            label: "Cargar Resultado",
            icon: Trophy,
            onClick: onOpenResultDialog,
            className: "text-emerald-600 hover:text-emerald-700"
          },
          {
            label: "Cambiar Cancha",
            icon: Edit,
            onClick: handleEditCourt,
            className: "text-blue-600 hover:text-blue-700"
          },
          {
            label: "Eliminar Partido",
            icon: Trash2,
            onClick: handleDeleteMatch,
            className: "text-red-600 hover:text-red-700"
          }
        );
        break;

      case "FINISHED":
        actions.push(
          {
            label: "Editar Resultado",
            icon: Edit,
            onClick: onOpenResultDialog,
            className: "text-emerald-600 hover:text-emerald-700"
          },
          {
            label: "Reactivar Partido",
            icon: Play,
            onClick: () => onUpdateMatch(matchId, { status: "IN_PROGRESS" }),
            className: "text-blue-600 hover:text-blue-700"
          }
        );
        break;

      case "CANCELED":
        actions.push(
          {
            label: "Reactivar Partido",
            icon: Play,
            onClick: () => onUpdateMatch(matchId, { status: "PENDING" }),
            className: "text-blue-600 hover:text-blue-700"
          },
          {
            label: "Eliminar Partido",
            icon: Trash2,
            onClick: handleDeleteMatch,
            className: "text-red-600 hover:text-red-700"
          }
        );
        break;

      case "BYE":
        // BYE matches are automatically completed, no actions needed
        break;

      case "WAITING_OPONENT":
        // Agregar "Procesar Ganador" si es BYE o match completo
        if (canProcessWinner) {
          actions.push({
            label: isBye ? "Procesar BYE" : "Marcar Listo",
            icon: FastForward,
            onClick: handleProcessBye,
            className: "text-emerald-600 hover:text-emerald-700"
          });
        }
        break;
    }

    return actions;
  };

  const actions = getAvailableActions();

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menú</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action, index) => (
            <div key={action.label}>
              <DropdownMenuItem
                onClick={action.onClick}
                className={`cursor-pointer ${action.className}`}
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
              </DropdownMenuItem>
              {index < actions.length - 1 && <DropdownMenuSeparator />}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <StartMatchDialog
        isOpen={startDialogOpen}
        onClose={() => setStartDialogOpen(false)}
        onConfirm={handleStartMatch}
        matchInfo={matchInfo}
      />
    </>
  );
} 