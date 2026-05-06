"use client"

import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"

interface BatacazoBadgeProps {
  points: number
  size?: "sm" | "md" | "lg"
  compact?: boolean // Nuevo: versión compacta (solo icono)
}

const BatacazoBadge = ({ points, size = "md", compact = false }: BatacazoBadgeProps) => {
  // Solo mostrar si los puntos ganados son mayores a 18
  if (points <= 18) {
    return null
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  }

  // Estilos base
  const baseClasses = `
    ${sizeClasses[size]}
    bg-orange-500
    text-white
    font-bold
    flex
    items-center
    gap-1
    shadow-md
    ${compact ? "" : "animate-pulse"}
  `

  return (
    <Badge
      variant="destructive"
      className={baseClasses}
      aria-label="Batacazo"
      title="Batacazo"
    >
      <Zap className="h-3 w-3" />
      {!compact && "BATACAZO"}
    </Badge>
  )
}

export default BatacazoBadge 