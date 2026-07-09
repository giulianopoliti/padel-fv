'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, CheckCircle2, GitBranch, Info } from 'lucide-react'
import { updateLongBracketMatchRequirement } from '../actions'

interface LongBracketMatchRequirementToggleProps {
  tournamentId: string
  initialEnabled: boolean
}

export default function LongBracketMatchRequirementToggle({
  tournamentId,
  initialEnabled,
}: LongBracketMatchRequirementToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleToggle = async (newValue: boolean) => {
    setLoading(true)
    setMessage(null)

    try {
      const result = await updateLongBracketMatchRequirement(tournamentId, newValue)

      if (result.success) {
        setEnabled(newValue)
        setMessage({
          type: 'success',
          text: result.data?.message || 'Configuracion actualizada',
        })
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Error al actualizar la configuracion',
        })
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Error inesperado al cambiar la configuracion',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-start gap-3">
          <GitBranch className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-700" />
          <div className="flex-1">
            <Label htmlFor="long-bracket-match-requirement" className="cursor-pointer text-base font-medium">
              Exigir partidos completos antes de generar llave
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Si esta opcion esta apagada, la llave se arma con la tabla de posiciones actual.
            </p>
          </div>
        </div>
        <Switch
          id="long-bracket-match-requirement"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={loading}
          aria-label="Exigir partidos completos antes de generar llave"
        />
      </div>

      {message ? (
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
      ) : null}

      {!enabled ? (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            Al generar la llave se usaran las posiciones disponibles en ese momento, aunque haya parejas con menos partidos.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
