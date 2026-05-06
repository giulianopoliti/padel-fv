"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"

interface CourtSelectorProps {
  maxCourts: number
  selectedCourt?: string
  onCourtSelect: (court: string | undefined) => void
  disabled?: boolean
  className?: string
}

export default function CourtSelector({ 
  maxCourts, 
  selectedCourt, 
  onCourtSelect, 
  disabled = false,
  className = "" 
}: CourtSelectorProps) {
  const courtOptions = Array.from({ length: maxCourts }, (_, index) => (index + 1).toString())

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-slate-600" />
        <label className="text-sm font-medium text-slate-700">
          Cancha (Opcional)
        </label>
        {maxCourts > 0 && (
          <Badge variant="secondary" className="text-xs">
            {maxCourts} disponibles
          </Badge>
        )}
      </div>
      
      {maxCourts === 0 ? (
        <div className="text-sm text-slate-500 italic">
          No hay canchas configuradas para este club
        </div>
      ) : (
        <Select 
          value={selectedCourt || "unassigned"} 
          onValueChange={(value) => onCourtSelect(value === "unassigned" ? undefined : value)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar cancha (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {courtOptions.map((court) => (
              <SelectItem key={court} value={court}>
                Cancha {court}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      {selectedCourt && (
        <div className="text-xs text-slate-600">
          El partido se asignará a la Cancha {selectedCourt}
        </div>
      )}
    </div>
  )
}