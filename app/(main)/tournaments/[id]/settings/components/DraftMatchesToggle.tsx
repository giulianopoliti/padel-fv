'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileEdit, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { toggleDraftMatches } from '../actions'

interface DraftMatchesToggleProps {
  tournamentId: string
  initialEnabled: boolean
}

export default function DraftMatchesToggle({ tournamentId, initialEnabled }: DraftMatchesToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleToggle = async (newValue: boolean) => {
    setLoading(true)
    setMessage(null)

    try {
      const result = await toggleDraftMatches(tournamentId, newValue)

      if (result.success) {
        setEnabled(newValue)
        setMessage({
          type: 'success',
          text: result.data?.message || 'Configuración actualizada'
        })
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Error al actualizar la configuración'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error inesperado al cambiar la configuración'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3 flex-1">
          <FileEdit className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <Label htmlFor="draft-mode" className="text-base font-medium cursor-pointer">
              Modo Borrador de Partidos
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Los nuevos partidos se crearán como borradores y deberás publicarlos manualmente
            </p>
          </div>
        </div>
        <Switch
          id="draft-mode"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={loading}
          aria-label="Activar modo borrador"
        />
      </div>

      {message && (
        <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {enabled && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Modo activo:</strong> Los partidos que crees aparecerán en la sección "Partidos en Borrador"
            de la programación de partidos. Los jugadores no verán estos partidos hasta que los publiques.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
