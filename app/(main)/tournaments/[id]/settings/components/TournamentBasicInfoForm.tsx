"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, FileText, Users, AlertCircle } from 'lucide-react'
import { updateTournamentBasicInfo } from '../actions'

interface TournamentBasicInfoFormProps {
  tournamentId: string
  initialData: {
    name: string
    description?: string | null
    max_participants?: number | null
  }
  inscriptionsCount: number
}

export default function TournamentBasicInfoForm({
  tournamentId,
  initialData,
  inscriptionsCount
}: TournamentBasicInfoFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(initialData.name)
  const [description, setDescription] = useState(initialData.description || '')
  const [maxParticipants, setMaxParticipants] = useState<number | ''>(
    initialData.max_participants || ''
  )
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  const handleInputChange = () => {
    setHasChanges(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasChanges) {
      toast({
        title: "Sin cambios",
        description: "No hay cambios para guardar",
        variant: "default"
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await updateTournamentBasicInfo({
        tournamentId,
        name: name.trim(),
        description: description.trim() || null,
        max_participants: maxParticipants === '' ? null : Number(maxParticipants)
      })

      if (result.success) {
        toast({
          title: "Cambios guardados",
          description: "La información del torneo se actualizó correctamente",
          variant: "default"
        })
        setHasChanges(false)

        // Refresh the page to show updated data everywhere
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast({
          title: "Error al guardar",
          description: result.error || "No se pudieron guardar los cambios",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error saving tournament info:', error)
      toast({
        title: "Error inesperado",
        description: "Ocurrió un error al guardar. Por favor, intenta nuevamente.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setName(initialData.name)
    setDescription(initialData.description || '')
    setMaxParticipants(initialData.max_participants || '')
    setHasChanges(false)
  }

  const isMaxParticipantsValid = () => {
    if (maxParticipants === '') return true
    const value = Number(maxParticipants)
    return value >= inscriptionsCount && value <= 256
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tournament Name */}
      <div className="space-y-2">
        <Label htmlFor="tournament-name" className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          Nombre del Torneo *
        </Label>
        <Input
          id="tournament-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            handleInputChange()
          }}
          placeholder="Ej: Torneo de Pádel Verano 2025"
          maxLength={100}
          required
          disabled={isLoading}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          {name.length}/100 caracteres
        </p>
      </div>

      {/* Tournament Description */}
      <div className="space-y-2">
        <Label htmlFor="tournament-description" className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-600" />
          Descripción
        </Label>
        <Textarea
          id="tournament-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            handleInputChange()
          }}
          placeholder="Describe el torneo, premios, reglas especiales, etc."
          rows={4}
          maxLength={500}
          disabled={isLoading}
          className="w-full resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/500 caracteres • Opcional
        </p>
      </div>

      {/* Max Participants */}
      <div className="space-y-2">
        <Label htmlFor="max-participants" className="flex items-center gap-2">
          <Users className="h-4 w-4 text-purple-600" />
          Máximo de Participantes
        </Label>
        <Input
          id="max-participants"
          type="number"
          value={maxParticipants}
          onChange={(e) => {
            const value = e.target.value
            setMaxParticipants(value === '' ? '' : Number(value))
            handleInputChange()
          }}
          placeholder="Sin límite"
          min={inscriptionsCount}
          max={256}
          disabled={isLoading}
          className="w-full"
        />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Inscripciones actuales: <strong>{inscriptionsCount} parejas</strong>
          </p>
          {maxParticipants !== '' && !isMaxParticipantsValid() && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                El máximo debe ser al menos {inscriptionsCount} (inscripciones actuales) y no más de 256
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="submit"
          disabled={isLoading || !hasChanges || !isMaxParticipantsValid()}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </>
          )}
        </Button>

        {hasChanges && (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isLoading}
          >
            Cancelar
          </Button>
        )}
      </div>

      {/* Info Alert */}
      {hasChanges && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-sm">
            Tienes cambios sin guardar. Haz clic en "Guardar Cambios" para aplicarlos.
          </AlertDescription>
        </Alert>
      )}
    </form>
  )
}
