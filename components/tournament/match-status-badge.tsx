"use client";

import { Badge } from "@/components/ui/badge";
import { Database } from "@/database.types";
import { Clock, Play, CheckCircle, XCircle, UserX, Hourglass, Users } from "lucide-react";
import { MATCH_STATUS, getMatchStatusLabel, getMatchStatusVariant, type MatchStatus } from "@/types/match-status";

type DBMatchStatus = Database["public"]["Enums"]["match_status"];

interface MatchStatusBadgeProps {
  status: MatchStatus | DBMatchStatus;
  court?: string | null;
  className?: string;
  couple1_id?: string | null;
  couple2_id?: string | null;
  isFromInitialGeneration?: boolean;
  showExtraInfo?: boolean; // Para mostrar información adicional
  hideCourt?: boolean; // Nuevo: ocultar badge de cancha
}

const statusConfig = {
  PENDING: {
    label: "Pendiente",
    variant: "secondary" as const,
    icon: Clock,
    className: "bg-gray-100 text-gray-700 border-gray-300"
  },
  IN_PROGRESS: {
    label: "En Curso",
    variant: "default" as const,
    icon: Play,
    className: "bg-blue-100 text-blue-700 border-blue-300"
  },
  FINISHED: {
    label: "Finalizado",
    variant: "default" as const,
    icon: CheckCircle,
    className: "bg-green-100 text-green-700 border-green-300"
  },
  CANCELED: {
    label: "Cancelado",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-red-100 text-red-700 border-red-300"
  },
  BYE: {
    label: "BYE",
    variant: "secondary" as const,
    icon: UserX,
    className: "bg-purple-100 text-purple-700 border-purple-300"
  },
  WAITING_OPONENT: {
    label: "Esperando Oponente",
    variant: "outline" as const,
    icon: Hourglass,
    className: "bg-orange-100 text-orange-700 border-orange-300"
  }
};

export default function MatchStatusBadge({ 
  status, 
  court, 
  className = "",
  couple1_id,
  couple2_id,
  isFromInitialGeneration = false,
  showExtraInfo = false,
  hideCourt = false
}: MatchStatusBadgeProps) {
  console.log('MatchStatusBadge props:', { status, court, couple1_id, couple2_id, isFromInitialGeneration });
  
  // Validar el estado basándose en la nueva lógica
  const hasOneCouple = (couple1_id && !couple2_id) || (!couple1_id && couple2_id);
  const hasBothCouples = couple1_id && couple2_id;
  
  let effectiveStatus = status;
  let effectiveLabel = getMatchStatusLabel(status as MatchStatus);
  
  // Aplicar validación adicional si tenemos información de las parejas
  if (showExtraInfo && couple1_id !== undefined && couple2_id !== undefined) {
    if (hasOneCouple) {
      if (isFromInitialGeneration && status === 'BYE') {
        effectiveLabel = "BYE (Avance Automático)";
      } else if (!isFromInitialGeneration && status === 'WAITING_OPONENT') {
        effectiveLabel = "Esperando Rival";
      } else if (status === 'FINISHED' && !isFromInitialGeneration) {
        // Posible caso problemático
        effectiveLabel = "⚠️ Posible Error";
      }
    } else if (hasBothCouples && status === 'PENDING') {
      effectiveLabel = "Listo para Jugar";
    }
  }
  
  const config = statusConfig[effectiveStatus as keyof typeof statusConfig];
  
  if (!config) {
    // Fallback usando las funciones helper
    return (
      <Badge 
        variant={getMatchStatusVariant(status as MatchStatus)}
        className={`${className} flex items-center gap-1 text-xs font-medium`}
      >
        <Clock className="h-3 w-3" />
        {effectiveLabel}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={config.variant}
        className={`${config.className} ${className} flex items-center gap-1 text-xs font-medium`}
      >
        <Icon className="h-3 w-3" />
        {effectiveLabel}
      </Badge>
      
      {/* Información adicional del partido */}
      {showExtraInfo && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3" />
          {hasBothCouples ? "2/2" : hasOneCouple ? "1/2" : "0/2"}
        </div>
      )}
      
      {/* Mostrar cancha si está disponible y no se quiere ocultar */}
      {!hideCourt && court && (
        <Badge variant="outline" className="text-xs">
          Cancha {court}
        </Badge>
      )}
    </div>
  );
} 